# Deployment

The course and the feedback service run on the Sankofa stand (the `museum`
cluster in the workshop Cozystack) at
<https://damn.academy>.

| Path | Served by |
|---|---|
| `/` | `web`: nginx-unprivileged with the built course and the v86 images |
| `/api/feedback` | `feedback`: the Go service from `service/feedback`, SQLite on the node's disk |
| `/admin` | `feedback`: the review UI, HTTP Basic auth |

nginx sends `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` on every response (v86 workers and
`SharedArrayBuffer` need cross-origin isolation). Hashed Vite assets,
content-addressed lab files and boot snapshots are cached for a year;
`index.html`, `sw.js`, manifests and the kernel are revalidated by ETag. Text
files are precompressed with gzip; the stock nginx image has no brotli module.
`/rv64/node/` serves the published kube-wasm node (content-addressed objects
the page decodes itself, immutable; `node.json` revalidated) and `/rv64/` the
RV64 core it was captured on. They are not in git: `deploy/kube-node.ref`
names a one-layer image in the stand registry and the build appends that
layer to the site image; see "Publishing a node" in `tools/kube-wasm/README.md`.

## Requirements

- A checkout of the Sankofa stand at `~/projects/sankofa-int` (or `SANKOFA_ROOT`):
  `hack/stand/env.sh` defines `km`, which is `kubectl` with the museum
  kubeconfig and an explicit `--context`. The node-local registry runs in the
  `sankofa-registry` namespace.
- git, `kubectl`, `curl` and `openssl` on the workstation. Nothing is built
  there: no Docker, no VMs, no large uploads.

The public host also has to be listed in the outer ingress of the stand: the
workshop cluster lets through only the hosts in
`spec.addons.ingressNginx.hosts` of the Cozystack application
`kubernetes.apps.cozystack.io/museum` (namespace `tenant-sankofa`, kubeconfig
`~/workshop.txt`, context `admin@workshop`). `damn.academy` and `www.damn.academy` were added there, next to
`dormer.sankofa.workshop.aenix.io`. DNS for `damn.academy` (GoDaddy) points the
apex `A` record at the workshop ingress, `95.217.172.133`, and `www` is a `CNAME`
to the apex; `www` and the old stand address
`devops-trainer.sankofa.workshop.aenix.io` permanently redirect to
`https://damn.academy`. Without the hosts entry the
host answers `default backend - 404` and cert-manager cannot pass HTTP-01.

## Redeploy

Commit and push the branch you want to deploy, then:

```sh
deploy/deploy.sh            # build the pushed HEAD in the cluster, roll it out, check
deploy/deploy.sh --smoke    # the same, then the browser smoke check
deploy/smoke.sh             # only the smoke check
```

`deploy.sh` starts the Job `build-<commit>-<time>` (`deploy/build/job.yaml`,
script `deploy/build/build.sh`). A Go stage clones the commit from GitHub and
builds the feedback binary, the OpenTofu provider of the lab image and `crane`.
A Playwright stage runs `npm ci`, fetches the stock v86 assets, builds the
Alpine lab image and the boot snapshots (v86 in headless Chromium), builds the
course with `VITE_FEEDBACK_URL=https://<host>/api/feedback`, assembles the
nginx image with `crane append` and pushes both images to the registry of
every node. The script then applies `devops-trainer.yaml` with the image
digests, waits for both rollouts and checks the public `index.html`, the
isolation headers and that `/admin` asks for credentials. A build takes about
15–25 minutes; follow it with
`km -n devops-trainer logs -f job/<name> -c images`. Finished Jobs are removed
after a day.

`smoke.sh` runs `web/scripts/smoke-public.mjs` as a Job, also in the cluster:
the home page (and that it is cross-origin isolated), an explainer, a goal in
the simulated terminal, a real-Linux v86 lab started from its boot snapshot,
the first goal of the in-tab cloud lab, a feedback report sent through the
course and found in the admin UI. The admin token reaches the Job from the
Secret and is not printed. Each smoke run leaves one report marked
"Deployment smoke check" in the admin UI.

Only the manifest changed? Reuse the images of a finished build Job (they are
kept for a day) instead of building again:

```sh
km -n devops-trainer get jobs -l app.kubernetes.io/name=build
BUILD_JOB=build-<commit>-<time> deploy/deploy.sh
```

## Storage of the reports

SQLite lives in `/var/local/devops-trainer/feedback` on one node of the museum
cluster (a `hostPath`; `/var` survives reboots on Talos), and the `feedback` pod
is pinned to that node with a `nodeSelector`; `deploy.sh` keeps the node of the
running Deployment. A PVC would be the better home, but the stand's tenant
quota (`tenant-sankofa`, `requests.cpu`) leaves no room for the CDI importer
pod that provisions a new volume, so a PVC stays `Pending`. If that node is
replaced, the reports on it are lost: export them regularly (see below). Once
the quota allows, switch the `data` volume in `devops-trainer.yaml` back to a
PVC.

## Admin UI

Open <https://damn.academy/admin>. User name
`token`, password: the admin token from the Secret, which `deploy.sh`
generates once and never prints:

```sh
source ~/projects/sankofa-int/hack/stand/env.sh
km -n devops-trainer get secret feedback-secrets -o jsonpath='{.data.ADMIN_TOKEN}' | base64 -d; echo
```

Scripts can send `Authorization: Bearer <token>`, for example to
`/admin/export?format=jsonl`. To rotate the token, delete the Secret and run
`deploy/deploy.sh` again, or replace its value and run
`km -n devops-trainer rollout restart deploy/feedback`.

Notifications (SMTP, Telegram, GitHub) are off: none of their variables are set.
Rate limits are on. The ingress controller uses SSL passthrough, so the service
sees every client as the same address; `REPORT_LIMIT_PER_HOUR=300` and
`FOLLOW_LIMIT_PER_HOUR=3000` in `devops-trainer.yaml` are therefore shared by
all learners.

## Roll back

Every rollout keeps its image digest in the ReplicaSet history, and the
registry keeps the old images:

```sh
source ~/projects/sankofa-int/hack/stand/env.sh
km -n devops-trainer rollout history deploy/web
km -n devops-trainer rollout undo deploy/web                 # previous course build
km -n devops-trainer rollout undo deploy/web --to-revision=N
km -n devops-trainer rollout undo deploy/feedback            # previous service build
```

Learners whose service worker already cached the newer build get the older one
on their next visit (`sw.js` is never cached by the browser). The SQLite data
is not rolled back.

## Back up the reports

A CronJob `feedback-backup` exports the reports every night (03:23 in the
cluster's schedule) through the admin API and keeps the last 14 exports in
`/var/local/devops-trainer/feedback-backup` on the same node that holds the
SQLite file. This survives database corruption but not the loss of the node,
so copy the exports off the stand regularly. Check the schedule and the runs:

```sh
source ~/projects/sankofa-int/hack/stand/env.sh
km -n devops-trainer get cronjob feedback-backup
km -n devops-trainer get jobs -l app.kubernetes.io/name=feedback-backup
```

Manual export through the admin API (the service image has no shell or
`cat`):

```sh
token=$(km -n devops-trainer get secret feedback-secrets -o jsonpath='{.data.ADMIN_TOKEN}' | base64 -d)
curl -fsS -H "Authorization: Bearer $token" \
  'https://damn.academy/admin/export?format=jsonl' > feedback.jsonl
```

## Delete everything

Deleting the namespace removes the Deployments, Services, Ingresses, the
Secret with the admin token and the TLS certificate:

```sh
km delete namespace devops-trainer
```

The SQLite file stays on the node in `/var/local/devops-trainer/feedback` until
the node is replaced.

Images stay in the node-local registry (`sankofa/devops-trainer-web`,
`sankofa/devops-trainer-feedback`) until the stand's registry is cleaned.

## Objects

Namespace `devops-trainer`: build and smoke Jobs (kept for a day), ConfigMap
`build-script`, Deployments `web` (2 replicas) and `feedback`
(1 replica, `Recreate`), Services `web` and `feedback`, CronJob
`feedback-backup` (nightly export of the reports to the node disk), Secret `feedback-secrets`, Ingresses `web` and
`feedback` (the latter with the access log off, because thread URLs carry a
token), Certificate and Secret `devops-trainer-tls` from the `letsencrypt`
ClusterIssuer.
