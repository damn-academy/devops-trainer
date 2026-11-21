#!/usr/bin/env bash
# Build and deploy the course and the feedback service to the Sankofa stand.
#
#   deploy/deploy.sh          # reuse the lab image and boot snapshots if built
#   deploy/deploy.sh --lab    # rebuild the Alpine lab image and the snapshots
#
# Requires the Sankofa stand checkout (env.sh with km, the node-local
# registry in sankofa-registry), node/npm, go, ko and crane. Nothing runs in Docker on this machine.
set -euo pipefail
cd "$(dirname "$0")/.."
repo=$PWD
stand=${SANKOFA_ROOT:-$HOME/projects/sankofa-int}
source "$stand/hack/stand/env.sh"
export DT_HOST=${DT_HOST:-devops-trainer.sankofa.workshop.aenix.io}
[[ $DT_HOST =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || { echo 'Invalid DT_HOST' >&2; exit 1; }
export PATH="$HOME/go/bin:$PATH"
ns=devops-trainer
rebuild_lab=0
[[ ${1:-} == --lab ]] && rebuild_lab=1
build_id=$(git rev-parse --short=12 HEAD)
[[ -z $(git status --porcelain) ]] || build_id="$build_id-dirty"
work=$(mktemp -d "${TMPDIR:-/tmp}/dt-deploy.XXXXXX")
trap 'rm -rf "$work"' EXIT

# 1. The course. The lab image and snapshots are slow to make and only change
# with the lab image scripts or the v86 version, so they are reused by default.
cd "$repo/web"
npm ci --no-audit --no-fund
node scripts/fetch-v86.mjs
lab=public/v86/lab/manifest.json
if ((rebuild_lab)) || [[ ! -f $lab ]] || ! node -e 'process.exit(Object.keys(JSON.parse(require("fs").readFileSync(process.argv[1])).bootSnapshots ?? {}).length ? 0 : 1)' "$lab"; then
  npm run build:lab-image
  npm run build:lab-snapshots
fi
VITE_FEEDBACK_URL="https://$DT_HOST/api/feedback" npm run build

# 2. Image layers: v86 images (hundreds of MB, rarely change) apart from the
# site, so an unchanged layer is not pushed again.
mkdir -p "$work/v86/usr/share/nginx/html" "$work/site/usr/share/nginx/html" "$work/site/etc/nginx/conf.d"
cp -R dist/v86 "$work/v86/usr/share/nginx/html/"
rsync -a --exclude /v86 dist/ "$work/site/usr/share/nginx/html/"
cp "$repo/deploy/nginx.conf" "$work/site/etc/nginx/conf.d/default.conf"
cp "$repo/deploy/headers.conf" "$work/site/etc/nginx/dt-headers.conf"
# Precompressed copies for gzip_static (the stock image has no brotli module).
find "$work/site/usr/share/nginx/html" "$work/v86/usr/share/nginx/html/v86" -maxdepth 3 -type f \
  \( -name '*.js' -o -name '*.mjs' -o -name '*.css' -o -name '*.html' -o -name '*.json' -o -name '*.svg' -o -name '*.wasm' -o -name '*.webmanifest' -o -name '*.txt' \) \
  -size +1k -exec gzip -9 -n -k {} +
node "$repo/deploy/stamp.mjs" "$work/v86" "$work/site"
tars=()
for layer in v86 site; do
  (
    cd "$work/$layer"
    find . -type d -exec chmod 755 {} +
    find . -type f -exec chmod 644 {} +
    TZ=UTC find . -type d -exec touch -h -t 202001010000 {} +
    find . -mindepth 1 | LC_ALL=C sort | COPYFILE_DISABLE=1 tar --uid 0 --gid 0 --uname root --gname root --no-recursion -cf "$work/$layer.tar" -T -
  )
  tars+=(-f "$work/$layer.tar")
done
crane append --platform linux/amd64 -b nginxinc/nginx-unprivileged:1.29-alpine \
  "${tars[@]}" -t sankofa/devops-trainer-web:dev -o "$work/web.tar" >/dev/null

# 3. The feedback service: a static Go binary built with ko.
cd "$repo/service/feedback"
KO_DOCKER_REPO=localhost:5000/sankofa CGO_ENABLED=0 ko build --bare --platform=linux/amd64 --push=false \
  --tarball="$work/feedback.tar" . >/dev/null

# 4. Push to the node-local registry of every node, like the stand's push.sh,
# but through a port-forward on a free port: push.sh's fixed port may already
# be held by another forward. Upload once, then copy inside the cluster.
push() {
  local name=$1 tar=$2 pods first firstip port pf ref digest i
  pods=($(km -n sankofa-registry get pods -l app=registry -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.podIP}{"\n"}{end}' | sort))
  first=${pods[0]} firstip=${pods[1]}
  port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
  km -n sankofa-registry port-forward "pod/$first" "$port:5000" >/dev/null 2>&1 &
  pf=$!
  for _ in $(seq 1 30); do curl -sf "http://127.0.0.1:$port/v2/" >/dev/null && break; sleep 0.5; done
  ref=$(crane push --insecure "$tar" "127.0.0.1:$port/sankofa/$name:dev") || { kill $pf; return 1; }
  kill $pf 2>/dev/null || true
  digest=${ref##*@}
  for ((i = 2; i < ${#pods[@]}; i += 2)); do
    km -n sankofa-registry run "copy-$name-$RANDOM" --rm -i --quiet --restart=Never \
      --image=gcr.io/go-containerregistry/crane:v0.20.3 -- \
      copy --insecure "$firstip:5000/sankofa/$name@$digest" "${pods[$((i + 1))]}:5000/sankofa/$name:dev" >/dev/null
  done
  echo "localhost:5000/sankofa/$name@$digest"
}
FEEDBACK_IMAGE=$(push devops-trainer-feedback "$work/feedback.tar" | tail -1)
WEB_IMAGE=$(push devops-trainer-web "$work/web.tar" | tail -1)
for ref in "$WEB_IMAGE" "$FEEDBACK_IMAGE"; do
  [[ $ref =~ ^localhost:5000/sankofa/devops-trainer-[a-z]+@sha256:[a-f0-9]{64}$ ]] || { echo "push failed: $ref" >&2; exit 1; }
done

# 5. Apply. The admin token is generated once and only ever stored in the Secret.
sed -e "s#WEB_IMAGE#$WEB_IMAGE#g" -e "s#FEEDBACK_IMAGE#$FEEDBACK_IMAGE#g" \
  -e "s#DT_HOST#$DT_HOST#g" -e "s#'BUILD_ID'#'$build_id'#g" \
  "$repo/deploy/devops-trainer.yaml" > "$work/devops-trainer.yaml"
km create namespace $ns --dry-run=client -o yaml | km apply -f - >/dev/null
if ! km -n $ns get secret feedback-secrets >/dev/null 2>&1; then
  km -n $ns create secret generic feedback-secrets --from-literal=ADMIN_TOKEN="$(openssl rand -hex 32)" >/dev/null
fi
km apply -f "$work/devops-trainer.yaml"
km -n $ns rollout status deploy/web --timeout=300s
km -n $ns rollout status deploy/feedback --timeout=300s

# 6. Public checks: TLS, the new index.html, isolation headers, routing.
for attempt in {1..40}; do
  if curl --fail --silent --show-error --max-time 20 "https://$DT_HOST/" -o "$work/served.html" && cmp -s "$repo/web/dist/index.html" "$work/served.html"; then
    headers=$(curl -sI --max-time 20 "https://$DT_HOST/")
    grep -qi '^cross-origin-embedder-policy: require-corp' <<<"$headers" || { echo 'COEP header missing' >&2; exit 1; }
    grep -qi '^cross-origin-opener-policy: same-origin' <<<"$headers" || { echo 'COOP header missing' >&2; exit 1; }
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$DT_HOST/admin")
    [[ $code == 401 ]] || { echo "admin without credentials returned $code, want 401" >&2; exit 1; }
    echo "Deployed $WEB_IMAGE and $FEEDBACK_IMAGE (build $build_id) at https://$DT_HOST"
    exit 0
  fi
  sleep 5
done
echo 'The public host does not yet serve this build' >&2
exit 1
