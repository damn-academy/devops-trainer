// The Terraform/OpenTofu provider `lab` (tools/terraform-provider-lab) against
// the real cloud API of the tab (src/engine/cloud) with the mock VM backend,
// through a Node HTTP bridge: the official OpenTofu binary runs init, plan,
// apply, drift detection, import and destroy, with state in the in-tab S3.
//
// It needs Go (to build the provider for this machine) and downloads OpenTofu
// once (scripts/fetch-tofu.mjs), so it runs only on request:
//
//   TF_LAB=1 npx vitest run tests/terraform-provider-lab.test.ts
//
// The same provider, cross-compiled for linux/386, is in the lab image; the
// headless v86 run is tests/terraform-v86.test.ts.

import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Cloud } from '../src/engine/cloud/api';
import { S3Store } from '../src/engine/cloud/s3';
import { MockVmBackend } from '../src/engine/cloud/vm-backend';
import type { HttpHandler, HttpRequest } from '../src/engine/labhost/http';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const providerDir = join(root, '..', 'tools', 'terraform-provider-lab');
const enabled = !!process.env.TF_LAB;

function serve(handler: HttpHandler, host: string): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      const u = new URL(req.url ?? '/', `http://${host}`);
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v;
      const r: HttpRequest = { method: req.method ?? 'GET', target: req.url ?? '/', path: decodeURIComponent(u.pathname), query: u.searchParams, version: 'HTTP/1.1', headers, body: new Uint8Array(Buffer.concat(chunks)), host, remote: { ip: '10.0.0.11', port: 1 }, local: { ip: '10.0.0.1', port: 80 }, vlan: 1 };
      const out = await handler(r);
      res.writeHead(out.status, out.headers);
      res.end(out.body === undefined ? undefined : Buffer.from(typeof out.body === 'string' ? new TextEncoder().encode(out.body) : out.body));
    });
  });
  return new Promise((ok) =>
    server.listen(0, '127.0.0.1', () => {
      const a = server.address();
      ok({ server, url: `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}` });
    }),
  );
}

describe.skipIf(!enabled)('terraform-provider-lab with OpenTofu', () => {
  let dir: string;
  let api: { server: Server; url: string };
  let s3: { server: Server; url: string };
  let cloud: Cloud;
  let tofu: string;
  let env: NodeJS.ProcessEnv;
  const times: Record<string, number> = {};

  const run = async (name: string, args: string[], ok = [0]) => {
    const t = performance.now();
    try {
      const r = await exec(tofu, args, { cwd: join(dir, 'work'), env, maxBuffer: 1 << 24 });
      times[name] = Math.round(performance.now() - t);
      return { code: 0, out: r.stdout + r.stderr };
    } catch (e) {
      const x = e as { code: number; stdout: string; stderr: string };
      times[name] = Math.round(performance.now() - t);
      if (!ok.includes(x.code)) throw new Error(`tofu ${args.join(' ')} → ${x.code}\n${x.stdout}\n${x.stderr}`);
      return { code: x.code, out: x.stdout + x.stderr };
    }
  };
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(`${api.url}/v1/projects/default${path}`, { method, headers: { authorization: `Bearer ${cloud.state.bootstrapSecret}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: r.status === 204 ? null : await r.json() };
  };

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'dt-tf-'));
    cloud = new Cloud({ backend: new MockVmBackend({ bootMs: 300, totalMB: 1024 }), delays: { disk: 50, lb: 50 } });
    const store = new S3Store(cloud);
    api = await serve(cloud.handleHttp, 'api.cloud.lab');
    s3 = await serve(store.handle, 's3.cloud.lab');

    const { stdout } = await exec('node', [join(root, 'scripts', 'fetch-tofu.mjs')]);
    tofu = stdout.trim();
    const platform = `${process.platform === 'darwin' ? 'darwin' : 'linux'}_${process.arch === 'x64' ? 'amd64' : process.arch}`;
    const mirror = join(dir, 'plugins');
    const out = join(mirror, 'registry.opentofu.org', 'lab', 'lab', '0.1.0', platform);
    mkdirSync(out, { recursive: true });
    execFileSync('go', ['build', '-trimpath', '-ldflags', '-X main.version=0.1.0', '-o', join(out, 'terraform-provider-lab_v0.1.0'), '.'], { cwd: providerDir, env: { ...process.env, CGO_ENABLED: '0' } });
    writeFileSync(join(dir, 'tofurc'), `provider_installation {\n  filesystem_mirror {\n    path    = "${mirror}"\n    include = ["registry.opentofu.org/lab/*"]\n  }\n  direct {\n    exclude = ["registry.opentofu.org/lab/*"]\n  }\n}\n`);
    mkdirSync(join(dir, 'work'));
    env = { ...process.env, TF_CLI_CONFIG_FILE: join(dir, 'tofurc'), LAB_ENDPOINT: api.url, LAB_S3_ENDPOINT: s3.url, LAB_TOKEN: cloud.state.bootstrapSecret, TF_IN_AUTOMATION: '1', CHECKPOINT_DISABLE: '1' };
    expect((await call('POST', '/buckets', { name: 'tfstate' })).status).toBe(201);
    const keyId = cloud.state.keys[0].access_key_id;
    writeFileSync(
      join(dir, 'work', 'main.tf'),
      `terraform {
  required_providers {
    lab = { source = "lab/lab", version = "~> 0.1" }
  }
  backend "s3" {
    bucket = "tfstate"
    key    = "lab/terraform.tfstate"
    region = "lab-1"
    endpoints = { s3 = "${s3.url}" }
    use_path_style = true
    access_key = "${keyId}"
    secret_key = "lab"
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_lockfile                = true
  }
}

provider "lab" {}

data "lab_images" "all" {}
data "lab_flavors" "small" { min_memory_mb = 128 }
data "lab_subnet" "default" { name = "default" }

resource "lab_network" "app" {
  name   = "app"
  cidr   = "10.20.0.0/16"
  labels = { trainer = "devops", "dt-track" = "iac" }
}

resource "lab_subnet" "web" {
  name       = "web"
  network_id = lab_network.app.id
  cidr       = "10.20.1.0/24"
}

resource "lab_security_group" "web" {
  name = "web"
  rules = [
    { direction = "ingress", protocol = "tcp", port_min = 22, port_max = 22 },
    { direction = "ingress", protocol = "tcp", port_min = 80, port_max = 80, cidr = "10.0.0.0/8" },
    { direction = "ingress", protocol = "icmp" },
  ]
}

resource "lab_ssh_key" "me" {
  name       = "me"
  public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKk2x1Jw4m7cSbQm0yYp3o0bWq3QWQ9xwq3n1Y9p6v0z learner@ws"
}

resource "lab_disk" "data" {
  name    = "data"
  size_mb = 64
}

resource "lab_vm" "web" {
  name               = "web-1"
  flavor             = data.lab_flavors.small.names[0]
  image              = "alpine-3.20"
  subnet_id          = "default"
  security_group_ids = [lab_security_group.web.id]
  ssh_key_ids        = [lab_ssh_key.me.id]
  disk_ids           = [lab_disk.data.id]
  user_data          = "#!/bin/sh\\nrc-service nginx start\\n"
  labels             = { role = "web" }
}

resource "lab_lb" "web" {
  name          = "web"
  listeners     = [{ port = 80 }]
  target_vm_ids = [lab_vm.web.id]
}

resource "lab_dns_zone" "shop" {
  name = "shop.lab"
}

resource "lab_dns_record" "www" {
  zone_id = lab_dns_zone.shop.id
  name    = "www"
  type    = "A"
  values  = [lab_lb.web.vip]
}

resource "lab_bucket" "site" {
  name          = "site"
  force_destroy = true
}

resource "lab_object" "index" {
  bucket       = lab_bucket.site.name
  key          = "index.html"
  content      = "<h1>hello from tofu</h1>\\n"
  content_type = "text/html"
}

output "ip"     { value = lab_vm.web.ip }
output "vip"    { value = lab_lb.web.vip }
output "fqdn"   { value = lab_dns_record.www.fqdn }
output "images" { value = data.lab_images.all.names }
`,
    );
  }, 300_000);

  afterAll(() => {
    api?.server.close();
    s3?.server.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
    console.log('tofu times (ms)', JSON.stringify(times));
  });

  it('init, plan, apply, no-op plan, drift, import, destroy', async () => {
    const init = await run('init', ['init', '-input=false', '-no-color']);
    expect(init.out).toMatch(/Installed lab\/lab v0\.1\.0/);

    const plan = await run('plan', ['plan', '-input=false', '-no-color', '-out=tfplan']);
    expect(plan.out).toMatch(/Plan: 11 to add, 0 to change, 0 to destroy/);

    const apply = await run('apply', ['apply', '-input=false', '-no-color', 'tfplan']);
    expect(apply.out).toMatch(/Apply complete! Resources: 11 added/);
    const vm = cloud.state.vms.find((v) => v.name === 'web-1')!;
    expect(vm.status).toBe('RUNNING');
    expect(vm.disk_ids).toHaveLength(1);
    expect(cloud.state.records.find((r) => r.name === 'www')!.values[0]).toBe(cloud.state.loadBalancers[0].vip);
    // State went to the in-tab S3, the lock file was removed after the apply.
    const st = await fetch(`${s3.url}/tfstate/lab/terraform.tfstate`, { headers: { authorization: `AWS4-HMAC-SHA256 Credential=${cloud.state.keys[0].access_key_id}/x` } });
    expect(st.status).toBe(200);
    expect(JSON.stringify(await st.json())).toContain('lab_vm');

    const again = await run('plan-noop', ['plan', '-input=false', '-no-color', '-detailed-exitcode'], [0]);
    expect(again.out).toMatch(/No changes/);

    // Drift: a label changed in the console, the object overwritten, a record deleted.
    expect((await call('PATCH', `/vms/${vm.id}`, { labels: { role: 'db' } })).status).toBe(200);
    const keyId = cloud.state.keys[0].access_key_id;
    await fetch(`${s3.url}/site/index.html`, { method: 'PUT', body: 'defaced', headers: { authorization: `AWS4-HMAC-SHA256 Credential=${keyId}/x` } });
    const rec = cloud.state.records.find((r) => r.name === 'www')!;
    expect((await call('DELETE', `/dns/zones/${rec.zone_id}/records/${rec.id}`)).status).toBe(204);
    const drift = await run('plan-drift', ['plan', '-input=false', '-no-color', '-detailed-exitcode'], [2]);
    expect(drift.out).toMatch(/lab_vm\.web will be updated in-place/);
    expect(drift.out).toMatch(/"role" = "db" -> "web"/);
    expect(drift.out).toMatch(/lab_object\.index will be updated in-place/);
    expect(drift.out).toMatch(/lab_dns_record\.www will be created/);
    expect(drift.out).toMatch(/Plan: 1 to add, 2 to change, 0 to destroy/);
    await run('apply-drift', ['apply', '-input=false', '-no-color', '-auto-approve']);
    expect(cloud.state.vms[0].labels.role).toBe('web');
    expect((await run('plan-noop2', ['plan', '-input=false', '-no-color', '-detailed-exitcode'], [0])).out).toMatch(/No changes/);

    // Import: forget the zone and the record, import them by name.
    await run('state-rm', ['state', 'rm', 'lab_dns_record.www', 'lab_dns_zone.shop']);
    await run('import-zone', ['import', '-input=false', '-no-color', 'lab_dns_zone.shop', 'shop.lab']);
    await run('import-record', ['import', '-input=false', '-no-color', 'lab_dns_record.www', 'shop.lab/www']);
    expect((await run('plan-import', ['plan', '-input=false', '-no-color', '-detailed-exitcode'], [0, 2])).out).not.toMatch(/must be replaced/);

    // A VM deleted outside Terraform is created again.
    expect((await call('DELETE', `/vms/${vm.id}`)).status).toBe(202);
    await new Promise((r) => setTimeout(r, 600));
    const gone = await run('plan-gone', ['plan', '-input=false', '-no-color', '-detailed-exitcode'], [2]);
    expect(gone.out).toMatch(/lab_vm\.web will be created/);

    const destroy = await run('destroy', ['destroy', '-input=false', '-no-color', '-auto-approve']);
    expect(destroy.out).toMatch(/Destroy complete!/);
    expect(cloud.state.vms).toHaveLength(0);
    expect(cloud.state.disks).toHaveLength(0);
    expect(cloud.state.networks.map((n) => n.name)).toEqual(['default']);
    expect(cloud.state.buckets.map((b) => b.name)).toEqual(['tfstate']);
  }, 600_000);
});
