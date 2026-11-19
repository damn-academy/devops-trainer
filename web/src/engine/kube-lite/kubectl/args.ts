// kubectl's flag parsing (cobra/pflag behaviour): --flag=value, --flag value,
// -n value, -nvalue, combined booleans (-it), `--` ends flags. Flags that
// exist in the real kubectl but not in kube-lite are reported by the trainer
// instead of "unknown flag", so a learner who found a real flag in the docs
// is not told it does not exist (05 §5.5).

export interface FlagDef {
  long: string;
  short?: string;
  /** Takes a value. 'optional': --dry-run alone means client. */
  value?: boolean | 'optional';
  /** May repeat (--image, --from-literal, -f). */
  multi?: boolean;
}

export interface Parsed {
  args: string[];
  flags: Record<string, string | boolean | string[]>;
  /** After `--`. */
  rest: string[] | null;
  dash: boolean;
  error?: string;
  /** A real kubectl flag the training cluster does not implement. */
  unsupported?: string;
}

/** Global flags of every command. */
export const GLOBAL: FlagDef[] = [
  { long: 'namespace', short: 'n', value: true },
  { long: 'context', value: true },
  { long: 'kubeconfig', value: true },
  { long: 'help', short: 'h' },
  { long: 'v', short: 'v', value: true },
  { long: 'request-timeout', value: true },
];

/** Real kubectl flags kube-lite accepts but does not model. */
export const REAL_BUT_UNSUPPORTED = new Set([
  'server-side',
  'prune',
  'kustomize',
  'k',
  'template',
  'chunk-size',
  'subresource',
  'raw',
  'validate',
  'save-config',
  'field-manager',
  'as',
  'as-group',
  'as-uid',
  'insecure-skip-tls-verify',
  'token',
  'server',
  's',
  'certificate-authority',
  'client-certificate',
  'client-key',
  'user',
  'cluster',
  'match-server-version',
  'tls-server-name',
  'cache-dir',
  'disable-compression',
  'show-managed-fields',
  'output-watch-events',
  'watch-only',
  'server-print',
  'pod-running-timeout',
  'quiet',
  'q',
  'overrides',
  'privileged',
  'annotations',
  'expose',
  'record',
  'force-conflicts',
  'grace-period-timeout',
  'disable-eviction',
  'skip-wait-for-delete-timeout',
  'pod-selector',
  'chunk',
  'limit-bytes',
  'max-log-requests',
  'ignore-errors',
  'insecure-skip-tls-verify-backend',
  'external-ip',
  'load-balancer-ip',
  'session-affinity',
  'cluster-ip',
  'selector-override',
  'filename-override',
  'local',
  'resources',
  'containers',
  'api-version',
  'output-version',
  'no-color',
  'attach',
  'leave-stdin-open',
  'pod-running-timeout',
  'show-events',
  'show-kind',
  'ignore-not-found',
  'wait',
  'all-containers',
]);

export function parseArgs(argv: string[], defs: FlagDef[]): Parsed {
  const all = [...GLOBAL, ...defs];
  const byLong = new Map(all.map((d) => [d.long, d]));
  const byShort = new Map(all.filter((d) => d.short).map((d) => [d.short!, d]));
  const out: Parsed = { args: [], flags: {}, rest: null, dash: false };
  const set = (d: FlagDef, v: string | boolean) => {
    if (d.multi) {
      const prev = out.flags[d.long];
      out.flags[d.long] = [...(Array.isArray(prev) ? prev : []), String(v)];
    } else out.flags[d.long] = v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      out.rest = argv.slice(i + 1);
      out.dash = true;
      break;
    }
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
      const d = byLong.get(name);
      if (!d) {
        if (REAL_BUT_UNSUPPORTED.has(name)) {
          out.unsupported = `--${name}`;
          if (eq < 0 && argv[i + 1] && !argv[i + 1].startsWith('-') && !['server-side', 'prune', 'validate', 'save-config', 'record', 'force-conflicts', 'local', 'show-managed-fields', 'watch-only', 'quiet', 'privileged', 'no-color', 'ignore-not-found', 'all-containers', 'show-events', 'show-kind', 'wait'].includes(name)) i++;
          continue;
        }
        out.error = `error: unknown flag: --${name}`;
        return out;
      }
      if (d.value === true) {
        if (eq > 0) set(d, a.slice(eq + 1));
        else if (i + 1 < argv.length) set(d, argv[++i]);
        else {
          out.error = `error: flag needs an argument: --${name}`;
          return out;
        }
      } else if (d.value === 'optional') set(d, eq > 0 ? a.slice(eq + 1) : 'client');
      else set(d, eq > 0 ? a.slice(eq + 1) !== 'false' : true);
      continue;
    }
    if (a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) {
      // -n value, -nvalue, -it, -o=yaml
      let j = 1;
      while (j < a.length) {
        const ch = a[j];
        const d = byShort.get(ch);
        if (!d) {
          if (REAL_BUT_UNSUPPORTED.has(ch)) {
            out.unsupported = `-${ch}`;
            j = a.length;
            break;
          }
          out.error = `error: unknown shorthand flag: '${ch}' in ${a}`;
          return out;
        }
        if (d.value) {
          let v = a.slice(j + 1);
          if (v.startsWith('=')) v = v.slice(1);
          if (!v) {
            if (d.value === 'optional') v = 'client';
            else if (i + 1 < argv.length) v = argv[++i];
            else {
              out.error = `error: flag needs an argument: '${ch}' in -${ch}`;
              return out;
            }
          }
          set(d, v);
          break;
        }
        set(d, true);
        j++;
      }
      continue;
    }
    out.args.push(a);
  }
  return out;
}

export function str(p: Parsed, name: string): string | undefined {
  const v = p.flags[name];
  if (Array.isArray(v)) return v[v.length - 1];
  return typeof v === 'string' ? v : undefined;
}

export function list(p: Parsed, name: string): string[] {
  const v = p.flags[name];
  if (Array.isArray(v)) return v;
  return typeof v === 'string' ? [v] : [];
}

export function bool(p: Parsed, name: string): boolean {
  const v = p.flags[name];
  return v === true || v === 'true';
}

/** Levenshtein distance, for "did you mean". */
export function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
