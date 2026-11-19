// What `kubectl exec <pod> -- <command>` runs inside a simulated container:
// the tools of its image (05 §5.2: trainer/client has curl, nslookup, dig,
// nc, ss) over the pod's view of the world — its env, /etc/resolv.conf with
// the cluster search list, mounted ConfigMaps and Secrets, the service
// account files. Network commands go through kube-lite's network model.

import type { Cluster } from '../cluster';
import { lookupImage } from '../images';
import { containerEnv } from '../kubelet';
import { httpFrom, resolve, resolvConf, DNS_IP } from '../network';
import { unb64 } from '../admission';
import type { Obj } from '../util';

export interface ExecOut {
  out: string;
  err: string;
  code: number;
}

/** Files a container sees: mounts from volumes, resolv.conf, hostname, the SA token. */
export function podFiles(c: Cluster, pod: Obj, ct: Obj): Record<string, string> {
  const ns = pod.metadata.namespace;
  const files: Record<string, string> = {
    '/etc/resolv.conf': resolvConf(ns, Number((pod.spec.dnsConfig?.options ?? []).find((o: Obj) => o.name === 'ndots')?.value ?? 5)),
    '/etc/hostname': `${pod.metadata.name}\n`,
    '/etc/hosts': `# Kubernetes-managed hosts file.\n127.0.0.1\tlocalhost\n${pod.status?.podIP ?? ''}\t${pod.metadata.name}\n`,
  };
  const vols: Obj[] = pod.spec.volumes ?? [];
  for (const m of ct.volumeMounts ?? []) {
    const v = vols.find((x) => x.name === m.name);
    if (!v) continue;
    const dir = String(m.mountPath).replace(/\/$/, '');
    if (v.configMap) {
      const cm = c.get('ConfigMap', ns, v.configMap.name);
      const items: Obj[] | undefined = v.configMap.items;
      for (const [k, val] of Object.entries(cm?.data ?? {})) {
        const item = items?.find((x) => x.key === k);
        if (items && !item) continue;
        files[m.subPath ? dir : `${dir}/${item?.path ?? k}`] = String(val);
      }
    } else if (v.secret) {
      const s = c.get('Secret', ns, v.secret.secretName);
      for (const [k, val] of Object.entries(s?.data ?? {})) files[`${dir}/${k}`] = unb64(String(val));
    } else if (v.projected) {
      files[`${dir}/namespace`] = ns;
      files[`${dir}/token`] = 'eyJhbGciOiJSUzI1NiIsImtpZCI6InRyYWluZXIifQ.eyJhdWQiOlsiaHR0cHM6Ly9rdWJlcm5ldGVzLmRlZmF1bHQuc3ZjLmNsdXN0ZXIubG9jYWwiXSwic3ViIjoic3lzdGVtOnNlcnZpY2VhY2NvdW50OmRlZmF1bHQ6ZGVmYXVsdCJ9.c2lnbmF0dXJl';
      files[`${dir}/ca.crt`] = '-----BEGIN CERTIFICATE-----\nMIIBdzCCAR2gAwIBAgIBADAKBggqhkjOPQQDAjAjMSEwHwYDVQQDDBhrM3Mtc2Vy\n-----END CERTIFICATE-----\n';
    } else if (v.emptyDir) {
      files[`${dir}/`] = '';
    }
  }
  return files;
}

function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/** Run one command line inside a container. */
export function podExec(c: Cluster, pod: Obj, ct: Obj, argv: string[]): ExecOut {
  const img = lookupImage(ct.image);
  const tools = img?.tools ?? [];
  const has = (t: string) => tools.includes(t) || ['echo', 'exit', 'true', 'false'].includes(t);
  const [cmd, ...args] = argv;
  if (!cmd) return { out: '', err: '', code: 0 };
  const name = cmd.replace(/^\/bin\/|^\/usr\/bin\//, '');
  if ((name === 'sh' || name === 'bash' || name === 'ash') && args[0] === '-c') {
    let res: ExecOut = { out: '', err: '', code: 0 };
    let all = '';
    let errs = '';
    for (const part of (args[1] ?? '').split(/\s*(?:;|&&)\s*/)) {
      if (!part.trim()) continue;
      res = podExec(c, pod, ct, tokenize(part));
      all += res.out;
      errs += res.err;
      if (res.code !== 0) break;
    }
    return { out: all, err: errs, code: res.code };
  }
  if (!has(name)) {
    return {
      out: '',
      err: `error: Internal error occurred: Internal error occurred: error executing command in container: failed to exec in container: failed to start exec "${pod.metadata.uid.slice(0, 12)}": OCI runtime exec failed: exec failed: unable to start container process: exec: "${cmd}": executable file not found in $PATH: unknown\n`,
      code: 1,
    };
  }
  const env = { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', HOSTNAME: pod.metadata.name, ...serviceEnv(c, pod.metadata.namespace), ...containerEnv(c, pod, ct).env, HOME: '/root' };
  const files = podFiles(c, pod, ct);
  switch (name) {
    case 'echo':
      return { out: args.join(' ').replace(/\$(\w+)|\$\{(\w+)\}/g, (_m, a: string, b: string) => env[(a ?? b) as keyof typeof env] ?? '') + '\n', err: '', code: 0 };
    case 'true':
      return { out: '', err: '', code: 0 };
    case 'false':
      return { out: '', err: '', code: 1 };
    case 'hostname':
      return { out: `${pod.metadata.name}\n`, err: '', code: 0 };
    case 'env':
    case 'printenv': {
      if (name === 'printenv' && args[0]) {
        const v = (env as Record<string, string>)[args[0]];
        return v === undefined ? { out: '', err: '', code: 1 } : { out: `${v}\n`, err: '', code: 0 };
      }
      return { out: Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', err: '', code: 0 };
    }
    case 'cat': {
      let out = '';
      let err = '';
      let code = 0;
      for (const f of args) {
        if (f in files) out += files[f];
        else {
          err += `cat: can't open '${f}': No such file or directory\n`;
          code = 1;
        }
      }
      return { out, err, code };
    }
    case 'ls': {
      const dir = (args.filter((a) => !a.startsWith('-'))[0] ?? '/').replace(/\/$/, '');
      const names = new Set<string>();
      for (const f of Object.keys(files)) if (f.startsWith(dir + '/')) names.add(f.slice(dir.length + 1).split('/')[0]);
      if (dir === '' || dir === '/') ['bin', 'dev', 'etc', 'home', 'proc', 'root', 'sys', 'tmp', 'usr', 'var'].forEach((n) => names.add(n));
      if (!names.size) return { out: '', err: `ls: ${dir}: No such file or directory\n`, code: 1 };
      return { out: [...names].filter(Boolean).sort().join('\n') + '\n', err: '', code: 0 };
    }
    case 'sleep':
      return { out: '', err: '', code: 0 };
    case 'nslookup': {
      const host = args.find((a) => !a.startsWith('-'));
      if (!host) return { out: '', err: 'BusyBox v1.37.0 multi-call binary.\n\nUsage: nslookup [-type=QUERY_TYPE] [-debug] HOST [DNS_SERVER]\n', code: 1 };
      const r = resolve(c, pod.metadata.namespace, host, 5, pod);
      if (r.error === 'TIMEOUT') return { out: ';; connection timed out; no servers could be reached\n\n', err: '', code: 1 };
      if (!r.ok) return { out: `Server:\t\t${DNS_IP}\nAddress:\t${DNS_IP}:53\n\n** server can't find ${host}.${pod.metadata.namespace}.svc.cluster.local: NXDOMAIN\n\n`, err: '', code: 1 };
      return { out: `Server:\t\t${DNS_IP}\nAddress:\t${DNS_IP}:53\n\n${r.ips.map((ip) => `Name:\t${r.fqdn}\nAddress: ${ip}\n`).join('')}\n`, err: '', code: 0 };
    }
    case 'dig': {
      const host = args.find((a) => !a.startsWith('+') && !a.startsWith('-') && !a.startsWith('@'));
      if (!host) return { out: '', err: '', code: 1 };
      const short = args.includes('+short');
      const r = resolve(c, pod.metadata.namespace, host, args.includes('+search') ? 5 : 1, pod);
      if (r.error === 'TIMEOUT') return { out: ';; communications error to 10.43.0.10#53: timed out\n;; no servers could be reached\n', err: '', code: 9 };
      if (short) return { out: r.ips.map((x) => x + '\n').join(''), err: '', code: 0 };
      const status = r.ok ? 'NOERROR' : 'NXDOMAIN';
      const q = r.fqdn ?? host;
      return {
        out: `; <<>> DiG 9.20.7 <<>> ${args.join(' ')}\n;; global options: +cmd\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: ${status}, id: 4711\n;; flags: qr aa rd; QUERY: 1, ANSWER: ${r.ips.length}, AUTHORITY: 0, ADDITIONAL: 1\n\n;; QUESTION SECTION:\n;${q}.\t\tIN\tA\n\n${r.ips.length ? `;; ANSWER SECTION:\n${r.ips.map((ip) => `${q}.\t30\tIN\tA\t${ip}`).join('\n')}\n\n` : ''};; Query time: 0 msec\n;; SERVER: ${DNS_IP}#53(${DNS_IP}) (UDP)\n;; MSG SIZE  rcvd: 106\n\n`,
        err: '',
        code: 0,
      };
    }
    case 'curl':
    case 'wget': {
      const url = args.filter((a, i) => !a.startsWith('-') && !['-o', '-w', '-m', '--max-time', '-H', '-O'].includes(args[i - 1] ?? '')).pop();
      if (!url) return { out: '', err: name === 'curl' ? "curl: try 'curl --help' or 'curl --manual' for more information\n" : 'BusyBox v1.37.0 multi-call binary.\n', code: 2 };
      const r = httpFrom(c, pod, url);
      const silent = args.some((a) => /^-[a-zA-Z]*s/.test(a) || a === '--silent');
      const head = args.some((a) => a === '-I' || a === '--head');
      const wIdx = args.indexOf('-w');
      const writeOut = wIdx >= 0 ? args[wIdx + 1] : undefined;
      const toNull = args.includes('/dev/null');
      if (!r.ok) {
        if (name === 'wget') return { out: '', err: `wget: can't connect to remote host: ${r.exit === 6 ? 'Name does not resolve' : r.exit === 7 ? 'Connection refused' : 'Connection timed out'}\n`, code: 1 };
        return { out: writeOut ? writeOut.replace('%{http_code}', '000') : '', err: silent && !args.some((a) => a.includes('S')) ? '' : r.error + '\n', code: r.exit };
      }
      if (writeOut) return { out: (toNull ? '' : (r.body ?? '') + '\n') + writeOut.replace('%{http_code}', String(r.status)).replace(/\\n/g, '\n'), err: '', code: 0 };
      if (head) return { out: `HTTP/1.1 ${r.status} ${r.status === 200 ? 'OK' : 'Not Found'}\nContent-Type: text/plain; charset=utf-8\nContent-Length: ${(r.body ?? '').length}\n\n`, err: '', code: 0 };
      if (name === 'wget' && r.status !== 200) return { out: '', err: `wget: server returned error: HTTP/1.1 ${r.status} Not Found\n`, code: 1 };
      return { out: (r.body ?? '') + '\n', err: '', code: 0 };
    }
    case 'nc': {
      const nums = args.filter((a) => !a.startsWith('-'));
      if (nums.length < 2) return { out: '', err: 'usage: nc [-46DdhklnrStUuvz] [-I length] [-i interval] destination port\n', code: 1 };
      const r = httpFrom(c, pod, `${nums[0]}:${nums[1]}/`);
      const ok = r.ok || r.exit === 52;
      return { out: '', err: ok ? `${nums[0]} (${nums[0]}:${nums[1]}) open\n` : `nc: ${nums[0]} (${nums[1]}): ${r.exit === 7 ? 'Connection refused' : 'Operation timed out'}\n`, code: ok ? 0 : 1 };
    }
    case 'ss':
    case 'netstat': {
      const ports = img?.ports ?? [];
      return { out: `State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process\n${ports.map((p) => `LISTEN 0      4096               *:${p}            *:*`).join('\n')}${ports.length ? '\n' : ''}`, err: '', code: 0 };
    }
  }
  return { out: '', err: `sh: ${cmd}: not found\n`, code: 127 };
}

/** The legacy service environment variables (WEB_SERVICE_HOST…), as enableServiceLinks gives. */
function serviceEnv(c: Cluster, ns: string): Record<string, string> {
  const out: Record<string, string> = { KUBERNETES_SERVICE_HOST: '10.43.0.1', KUBERNETES_SERVICE_PORT: '443', KUBERNETES_PORT: 'tcp://10.43.0.1:443' };
  for (const s of c.list('Service', ns)) {
    if (!s.spec.clusterIP || s.spec.clusterIP === 'None' || s.metadata.name === 'kubernetes') continue;
    const n = s.metadata.name.toUpperCase().replace(/-/g, '_');
    out[`${n}_SERVICE_HOST`] = s.spec.clusterIP;
    out[`${n}_SERVICE_PORT`] = String(s.spec.ports?.[0]?.port ?? '');
  }
  return out;
}

export { tokenize };
