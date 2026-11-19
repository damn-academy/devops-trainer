# terraform-provider-lab

Terraform/OpenTofu provider for the in-tab cloud of DevOps Trainer
(`api.cloud.lab`, contract in `web/src/engine/cloud/openapi.yaml`). Every
`lab_vm` is a real Linux machine emulated by v86 in the browser tab.

Russian version: [README.ru.md](README.ru.md).

## Resources and data sources

| Resource | Notes |
|---|---|
| `lab_network`, `lab_subnet` | A network is one VLAN on the lab switch |
| `lab_security_group` | `rules` are updated in place on running VMs |
| `lab_ssh_key` | Keys for `lab_vm.ssh_key_ids` |
| `lab_vm` | Creating it boots a machine; apply waits for the guest |
| `lab_disk` | Blank disk, attached with `lab_vm.disk_ids` |
| `lab_lb` | HTTP load balancer with a VIP |
| `lab_dns_zone`, `lab_dns_record` | Zones under `.lab` |
| `lab_bucket`, `lab_object` | S3-compatible storage at `s3.cloud.lab` |

Data sources: `lab_images`, `lab_flavors`, `lab_network`, `lab_subnet`.

Every resource supports `tofu import` by id or name. A DNS record is imported
as `<zone>/<record>` and an object as `<bucket>/<key>`. Read refreshes every
attribute from the API, so changes made in the Cloud panel show up as drift.
A resource deleted outside Terraform is planned for creation again. An object
whose ETag changed is planned for an update.

## Configuration

```hcl
provider "lab" {
  # endpoint    = "http://api.cloud.lab/v1"   # LAB_ENDPOINT
  # s3_endpoint = "http://s3.cloud.lab"       # LAB_S3_ENDPOINT
  # token       = "..."                       # LAB_TOKEN, secret of an access key
  # project     = "default"                   # LAB_PROJECT
}
```

## Build

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=386 go build -trimpath -ldflags "-s -w -X main.version=0.1.0" \
  -o dist/linux_386/terraform-provider-lab_v0.1.0 .
```

`web/scripts/build-lab-image.mjs` runs this build when the sources are newer
than the binary. It puts the binary in the image's filesystem mirror at
`/usr/share/terraform/plugins/registry.opentofu.org/lab/lab/0.1.0/linux_386/`,
and `registry.terraform.io` gets the same copy. It also installs `~/.tofurc`
and `~/.terraformrc` for `root` and `learner`, so `tofu init` works offline.

## Tests

```bash
cd web
TF_LAB=1 npx vitest run tests/terraform-provider-lab.test.ts   # host OpenTofu against the cloud API (mock VMs)
V86_TF=1 npx vitest run tests/terraform-v86.test.ts --silent=false   # inside v86, real VM
```
