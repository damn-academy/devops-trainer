# Deployment

The course and the feedback service run on the Sankofa stand (the `museum`
cluster in the workshop Cozystack) at
<https://devops-trainer.sankofa.workshop.aenix.io>.

| Path | Served by |
|---|---|
| `/` | `web`: nginx-unprivileged with the built course and the v86 images |
| `/api/feedback` | `feedback`: the Go service from `service/feedback`, SQLite on a PVC |
| `/admin` | `feedback`: the review UI, HTTP Basic auth |

nginx sends `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` on every response (v86 workers and
`SharedArrayBuffer` need cross-origin isolation). Hashed Vite assets,
content-addressed lab files and boot snapshots are cached for a year;
`index.html`, `sw.js`, manifests and the kernel are revalidated by ETag. Text
files are precompressed with gzip; the stock nginx image has no brotli module.

## Requirements

- A checkout of the Sankofa stand at `~/projects/sankofa-int` (or `SANKOFA_ROOT`):
  `hack/stand/env.sh` defines `km`, which is `kubectl` with the museum
  kubeconfig and an explicit `--context`; `hack/stand/push.sh` pushes images
  to the node-local registry.
- node and npm, go, `ko` and `crane` (in `~/go/bin`), `openssl`, `curl`.
  No Docker or VMs run on the workstation: images are assembled with
  `crane append` and `ko`.

## Redeploy

```sh
deploy/deploy.sh          # build the course and the service, push, apply, check
deploy/deploy.sh --lab    # also rebuild the Alpine lab image and the boot snapshots
```

The lab image (`npm run build:lab-image`) and the boot snapshots
(`npm run build:lab-snapshots`, which boots v86 in headless Chromium) are reused
when `web/public/v86/lab/manifest.json` already lists snapshots. Pass `--lab`
after changing the lab image scripts, `lab/` or the v86 version. Images are
referenced by digest; the script waits for both rollouts and checks the public
`index.html`, the isolation headers and that `/admin` asks for credentials.

## Admin UI

Open <https://devops-trainer.sankofa.workshop.aenix.io/admin>. User name
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

The service image has no shell or `cat`; export through the admin API:

```sh
token=$(km -n devops-trainer get secret feedback-secrets -o jsonpath='{.data.ADMIN_TOKEN}' | base64 -d)
curl -fsS -H "Authorization: Bearer $token" \
  'https://devops-trainer.sankofa.workshop.aenix.io/admin/export?format=jsonl' > feedback.jsonl
```

## Delete everything

Deleting the namespace removes the Deployments, Services, Ingresses, the
Secret with the admin token, the TLS certificate and the PVC with all reports:

```sh
km delete namespace devops-trainer
```

Images stay in the node-local registry (`sankofa/devops-trainer-web`,
`sankofa/devops-trainer-feedback`) until the stand's registry is cleaned.

## Objects

Namespace `devops-trainer`: Deployments `web` (2 replicas) and `feedback`
(1 replica, `Recreate`), Services `web` and `feedback`, PVC `feedback-data`
(1 Gi, default StorageClass), Secret `feedback-secrets`, Ingresses `web` and
`feedback` (the latter with the access log off, because thread URLs carry a
token), Certificate and Secret `devops-trainer-tls` from the `letsencrypt`
ClusterIssuer.
