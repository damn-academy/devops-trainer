// Offline reference pages for the in-tab cloud lessons: tofu init with a
// provider mirror and the lock file, the s3 backend with state locking, and
// the lab cloud API itself. Short summaries in the structure of the official
// pages, written for the course; the url points to the original.

import type { DocPage } from '../../core/types';

export const IAC_LAB_DOCS: DocPage[] = [
  {
    id: 'web/opentofu.org/cli/init',
    source: 'terraform',
    title: 'Command: init',
    url: 'https://opentofu.org/docs/cli/commands/init/',
    license: 'MPL-2.0',
    version: 'OpenTofu 1.10',
    sections: [
      { id: 'usage', title: 'Usage', body: 'Usage: tofu init [options]\n\nThe tofu init command initializes a working directory containing configuration files. This is the\nfirst command that should be run after writing a new configuration or cloning an existing one from\nversion control. It is safe to run this command multiple times.' },
      { id: 'providers', title: 'Plugin installation', body: 'During init, the configuration is searched for provider requirements (required_providers), and\nOpenTofu installs the matching plugins. By default it downloads them from the registry. Results\nare recorded in the dependency lock file .terraform.lock.hcl; later runs of init install the\nversions recorded there.' },
      { id: 'mirror', title: 'Installing from a local mirror', body: 'The provider_installation block of the CLI configuration (~/.tofurc) can name a\nfilesystem_mirror: a directory laid out as HOSTNAME/NAMESPACE/TYPE/VERSION/TARGET. Providers that\nmatch its include patterns are taken from there and never downloaded:\n\n    provider_installation {\n      filesystem_mirror {\n        path    = "/usr/share/terraform/plugins"\n        include = ["registry.opentofu.org/lab/*"]\n      }\n    }' },
      { id: 'lock', title: 'Dependency lock file', body: 'tofu init creates or updates .terraform.lock.hcl. It records the provider versions selected and\ntheir checksums. Include this file in your version control repository so that potential changes to\nthe external dependencies can be discussed in code review. The .terraform directory is a local\ncache and is not committed.' },
      { id: 'backend', title: 'Backend initialization', body: 'init configures the backend from the backend block. After changing the backend configuration run\n    tofu init -migrate-state\nto copy the existing state to the new backend (OpenTofu asks for confirmation), or\n    tofu init -reconfigure\nto ignore the existing state.' },
    ],
  },
  {
    id: 'web/opentofu.org/backend/s3',
    source: 'terraform',
    title: 'Backend type: s3',
    url: 'https://opentofu.org/docs/language/settings/backends/s3/',
    license: 'MPL-2.0',
    version: 'OpenTofu 1.10',
    sections: [
      { id: 'overview', title: 'S3', body: 'Stores the state as a given key in a given bucket on Amazon S3 or any S3-compatible storage.\nThis backend supports state locking, with a lock file in the same bucket (use_lockfile) or a\nDynamoDB table.' },
      { id: 'example', title: 'Example configuration', body: 'terraform {\n  backend "s3" {\n    bucket         = "tfstate"\n    key            = "lab/terraform.tfstate"\n    region         = "lab-1"\n    endpoints      = { s3 = "http://s3.cloud.lab" }\n    use_path_style = true\n    use_lockfile   = true\n\n    # An S3-compatible storage that is not AWS:\n    skip_credentials_validation = true\n    skip_region_validation      = true\n    skip_requesting_account_id  = true\n    skip_metadata_api_check     = true\n    skip_s3_checksum            = true\n  }\n}' },
      { id: 'credentials', title: 'Credentials', body: 'Do not write access keys into the configuration. The backend reads them from the environment:\nAWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (or a shared credentials file and profile).' },
      { id: 'locking', title: 'State locking', body: 'With use_lockfile = true, OpenTofu writes <key>.tflock next to the state before an operation that\nmay write it and removes it afterwards. A second run that finds the lock fails with\n    Error acquiring the state lock\nand prints who holds it. tofu force-unlock LOCK_ID removes a lock left by a crashed run; use it\nonly when you are sure that run is gone.' },
    ],
  },
  {
    id: 'web/api.cloud.lab/overview',
    source: 'help',
    title: 'The lab cloud API (api.cloud.lab)',
    url: 'https://opentofu.org/docs/language/resources/',
    license: 'Apache-2.0',
    version: 'lab-cloud 1.0',
    sections: [
      { id: 'endpoints', title: 'Endpoints', body: 'GET  /v1                     who the cloud is, where the other services are (no key)\nGET  /v1/flavors, /v1/images catalogue (no key)\nGET  /v1/whoami              the project of your access key\n/v1/projects/<project>/{vms,disks,networks,subnets,security-groups,ssh-keys,load-balancers,buckets}\n/v1/projects/<project>/dns/zones/<zone>/records\nGET  /v1/operations/<id>[?wait=N]\nThe full contract: GET http://api.cloud.lab/openapi.yaml' },
      { id: 'auth', title: 'Authentication', body: 'Authorization: Bearer <secret of an access key>\nWithout it: 401 Unauthenticated. With a key of another project: 403 PermissionDenied.' },
      { id: 'errors', title: 'Errors', body: '{"error": {"code": "InvalidArgument", "message": "...", "status": 400, "request_id": "req-...",\n           "details": {"field": "flavor"}}}\n400 InvalidArgument, 401 Unauthenticated, 403 PermissionDenied, 404 NotFound,\n409 AlreadyExists / Conflict / FailedPrecondition, 413 TooLarge, 429 QuotaExceeded.' },
      { id: 'operations', title: 'Long-running operations', body: 'Creating or deleting a VM, a disk or a load balancer answers 202 Accepted with an operation:\n    {"id": "op-...", "kind": "vm.create", "status": "PENDING", ...}\nPoll GET /v1/operations/<id> until status is DONE or ERROR; ?wait=30 holds the answer up to 30 s.' },
    ],
  },
];
