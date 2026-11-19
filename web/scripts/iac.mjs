// Infrastructure as code inside the lab image (design 00 §6.13): the official
// OpenTofu release for linux_386 and the trainer's provider `lab`
// (tools/terraform-provider-lab, cross-compiled with GOOS=linux GOARCH=386)
// in a filesystem mirror, plus the CLI configuration that makes `tofu init`
// work without the internet.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchTofu } from './fetch-tofu.mjs';
import { sha256 } from './build-lab-image.lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const PROVIDER_DIR = join(here, '..', '..', 'tools', 'terraform-provider-lab');
export const PROVIDER_VERSION = '0.1.0';
export const MIRROR = 'usr/share/terraform/plugins';
const HOSTS = ['registry.opentofu.org', 'registry.terraform.io'];

/** Go target of an Alpine architecture. */
const GO = { x86: { os: 'linux', arch: '386', platform: 'linux_386' } };

function newestSource(dir) {
  let t = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== 'dist') t = Math.max(t, newestSource(p));
    else if (/\.(go|mod|sum)$/.test(e.name)) t = Math.max(t, statSync(p).mtimeMs);
  }
  return t;
}

/** The provider binary for the target, rebuilt with Go when the sources are newer. */
export function providerBinary(platform = 'linux_386') {
  const [os, arch] = platform.split('_');
  const out = join(PROVIDER_DIR, 'dist', platform, `terraform-provider-lab_v${PROVIDER_VERSION}`);
  if (!existsSync(out) || statSync(out).mtimeMs < newestSource(PROVIDER_DIR)) {
    try {
      execFileSync('go', ['build', '-trimpath', '-buildvcs=false', '-ldflags', `-s -w -buildid= -X main.version=${PROVIDER_VERSION}`, '-o', out, '.'], {
        cwd: PROVIDER_DIR,
        env: { ...process.env, CGO_ENABLED: '0', GOOS: os, GOARCH: arch },
        stdio: ['ignore', 'inherit', 'inherit'],
      });
    } catch (e) {
      if (!existsSync(out)) throw new Error(`cannot build the provider (Go is needed: ${e.message}); or put a build at ${out}`);
      console.warn(`lab-image: Go build of the provider failed, using the existing ${out}`);
    }
  }
  return readFileSync(out);
}

/** Everything the image needs; `downloads` go to the manifest. */
export async function loadIac(alpineArch) {
  const t = GO[alpineArch];
  if (!t) throw new Error(`no OpenTofu target for ${alpineArch}`);
  const tofu = await fetchTofu(t.platform);
  const provider = providerBinary(t.platform);
  return {
    platform: t.platform,
    tofu: { version: tofu.record.version, binary: tofu.binary },
    providers: [{ name: 'lab/lab', version: PROVIDER_VERSION, binary: provider }],
    downloads: [tofu.record],
    built: [
      {
        file: `${MIRROR}/registry.opentofu.org/lab/lab/${PROVIDER_VERSION}/${t.platform}/terraform-provider-lab_v${PROVIDER_VERSION}`,
        from: 'tools/terraform-provider-lab',
        sha256: sha256(provider),
        size: provider.length,
        license: 'Apache-2.0 (dependencies: MPL-2.0 terraform-plugin-framework/-go, Apache-2.0 grpc, BSD-3-Clause protobuf)',
      },
    ],
  };
}

export const CLI_CONFIG = `# OpenTofu/Terraform CLI configuration of the lab machines. The provider
# lab/lab comes from the local mirror, so \`tofu init\` works without the
# internet; other providers would need the registry, which the tab cannot reach.
provider_installation {
  filesystem_mirror {
    path    = "/${MIRROR}"
    include = [${HOSTS.map((h) => `"${h}/lab/*"`).join(', ')}]
  }
  direct {
    exclude = [${HOSTS.map((h) => `"${h}/lab/*"`).join(', ')}]
  }
}
`;

export const PROFILE_SH = `# The in-tab cloud: API at api.cloud.lab, objects at s3.cloud.lab.
# LAB_TOKEN is the secret of an access key (the Cloud panel of the page shows
# it); the page may also write it to /etc/dt/cloud.env.
export LAB_ENDPOINT=http://api.cloud.lab/v1
export LAB_S3_ENDPOINT=http://s3.cloud.lab
export CHECKPOINT_DISABLE=1
[ -r /etc/dt/cloud.env ] && . /etc/dt/cloud.env
`;

export const EXAMPLE_TF = `# A VM in the in-tab cloud. Copy this directory, then:
#   export LAB_TOKEN=<secret from the Cloud panel>
#   tofu init && tofu apply
terraform {
  required_providers {
    lab = { source = "lab/lab", version = "~> 0.1" }
  }
}

provider "lab" {}

data "lab_images" "all" {}

variable "ssh_public_key" {
  type        = string
  description = "Your public key, e.g. the content of ~/.ssh/id_ed25519.pub"
}

resource "lab_vm" "web" {
  name                = "web-1"
  flavor              = "lab.small"
  image               = data.lab_images.all.names[0]
  ssh_authorized_keys = [var.ssh_public_key]
  labels              = { trainer = "devops", "dt-track" = "iac" }
}

output "ip" {
  value = lab_vm.web.ip
}
`;

export const BACKEND_TF = `# State in the object storage of the tab (create the bucket first:
# resource "lab_bucket" or POST /v1/projects/default/buckets).
terraform {
  backend "s3" {
    bucket                      = "tfstate"
    key                         = "lab/terraform.tfstate"
    region                      = "lab-1"
    endpoints                   = { s3 = "http://s3.cloud.lab" }
    use_path_style              = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_lockfile                = true
    # access_key = AKLAB... (the access key id), secret_key = anything:
    # set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY instead of writing them here.
  }
}
`;

/**
 * Adds the files to a profile's tree. `put(path, content, mode)` stores a
 * file; `file(path, content, mode, uid, gid)` stores one with an owner.
 */
export function addIac(iac, { put, file }) {
  put('usr/bin/tofu', iac.tofu.binary, 0o755);
  // OpenTofu speaks the Terraform CLI; lessons that say `terraform` work too.
  put('usr/local/bin/terraform', '#!/bin/sh\nexec /usr/bin/tofu "$@"\n', 0o755);
  for (const p of iac.providers)
    for (const host of HOSTS) put(`${MIRROR}/${host}/${p.name}/${p.version}/${iac.platform}/terraform-provider-${p.name.split('/')[1]}_v${p.version}`, p.binary, 0o755);
  for (const [home, uid] of [['root', 0], ['home/learner', 1000]])
    for (const name of ['.tofurc', '.terraformrc']) file(`${home}/${name}`, CLI_CONFIG, 0o644, uid, uid);
  put('etc/profile.d/lab-cloud.sh', PROFILE_SH);
  put('usr/share/doc/lab-cloud/examples/vm/main.tf', EXAMPLE_TF);
  put('usr/share/doc/lab-cloud/examples/vm/backend.tf.example', BACKEND_TF);
}
