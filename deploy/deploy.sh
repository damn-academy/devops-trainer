#!/usr/bin/env bash
# Deploy the course and the feedback service to the Sankofa stand.
#
#   deploy/deploy.sh            # build the pushed HEAD in the cluster and roll it out
#   deploy/deploy.sh --smoke    # the same, then run deploy/smoke.sh
#
# Everything heavy runs in a build Job inside the cluster (deploy/build/):
# the course, the v86 assets, the Alpine lab image, the boot snapshots
# (headless Chromium) and both images, pushed to the node-local registry.
# The workstation needs git, kubectl, curl and openssl, and the Sankofa stand
# checkout for env.sh (km: kubectl with the museum kubeconfig and --context).
set -euo pipefail
cd "$(dirname "$0")/.."
repo=$PWD
stand=${SANKOFA_ROOT:-$HOME/projects/sankofa-int}
source "$stand/hack/stand/env.sh"
export DT_HOST=${DT_HOST:-devops-trainer.sankofa.workshop.aenix.io}
[[ $DT_HOST =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || { echo 'Invalid DT_HOST' >&2; exit 1; }
GIT_URL=${GIT_URL:-https://github.com/tym83/devops-trainer}
ns=devops-trainer
sha=$(git rev-parse HEAD)
short=${sha:0:12}
# The Job builds from GitHub, so the commit must be there.
git fetch --quiet origin
[[ -n $(git branch -r --contains "$sha" 2>/dev/null) ]] || { echo "HEAD $short is not pushed to origin" >&2; exit 1; }
[[ -z $(git status --porcelain --untracked-files=no) ]] || echo "warning: uncommitted changes are not deployed" >&2
work=$(mktemp -d "${TMPDIR:-/tmp}/dt-deploy.XXXXXX")
trap 'rm -rf "$work"' EXIT

# 1. Namespace and the admin token, generated once and never printed.
km create namespace $ns --dry-run=client -o yaml | km apply -f - >/dev/null
if ! km -n $ns get secret feedback-secrets >/dev/null 2>&1; then
  km -n $ns create secret generic feedback-secrets --from-literal=ADMIN_TOKEN="$(openssl rand -hex 32)" >/dev/null
fi

# 2. Build in the cluster.
registries=$(km -n sankofa-registry get pods -l app=registry -o jsonpath='{range .items[*]}{.status.podIP}{" "}{end}')
[[ -n $registries ]] || { echo 'no registry pods' >&2; exit 1; }
job=build-$short-$(date +%H%M%S)
km -n $ns create configmap build-script --from-file="$repo/deploy/build/build.sh" --dry-run=client -o yaml | km apply -f - >/dev/null
sed -e "s#JOB_NAME#$job#g" -e "s#'GIT_URL'#'$GIT_URL'#" -e "s#'GIT_SHA'#'$sha'#" \
  -e "s#'DT_HOST'#'$DT_HOST'#" -e "s#'REGISTRIES'#'${registries% }'#" \
  "$repo/deploy/build/job.yaml" | km apply -f -
echo "Building $short in job/$job (logs: km -n $ns logs -f job/$job -c images)"
until status=$(km -n $ns get job "$job" -o jsonpath='{.status.succeeded}{.status.failed}') && [[ -n $status ]]; do sleep 15; done
km -n $ns logs "job/$job" -c images --tail=200 > "$work/build.log" 2>&1 || true
if [[ $(km -n $ns get job "$job" -o jsonpath='{.status.succeeded}') != 1 ]]; then
  km -n $ns logs "job/$job" -c tools --tail=40 >&2 || true
  tail -40 "$work/build.log" >&2
  echo "build job/$job failed" >&2
  exit 1
fi
WEB_IMAGE=$(awk '$1 == "IMAGE" && $2 == "devops-trainer-web" {print $3}' "$work/build.log")
FEEDBACK_IMAGE=$(awk '$1 == "IMAGE" && $2 == "devops-trainer-feedback" {print $3}' "$work/build.log")
for ref in "$WEB_IMAGE" "$FEEDBACK_IMAGE"; do
  [[ $ref =~ ^localhost:5000/sankofa/devops-trainer-[a-z]+@sha256:[a-f0-9]{64}$ ]] || { echo "no image digest in the build log: '$ref'" >&2; exit 1; }
done

# 3. Apply and wait.
sed -e "s#WEB_IMAGE#$WEB_IMAGE#g" -e "s#FEEDBACK_IMAGE#$FEEDBACK_IMAGE#g" \
  -e "s#DT_HOST#$DT_HOST#g" -e "s#'BUILD_ID'#'$short'#g" \
  "$repo/deploy/devops-trainer.yaml" | km apply -f -
km -n $ns rollout status deploy/web --timeout=300s
km -n $ns rollout status deploy/feedback --timeout=300s

# 4. Public checks: TLS, the index.html of this rollout, isolation headers, routing.
km -n $ns exec deploy/web -- cat /usr/share/nginx/html/index.html > "$work/built.html"
for attempt in {1..40}; do
  if curl --fail --silent --show-error --max-time 30 "https://$DT_HOST/" -o "$work/served.html" && cmp -s "$work/built.html" "$work/served.html"; then
    headers=$(curl -sI --max-time 30 "https://$DT_HOST/")
    grep -qi '^cross-origin-embedder-policy: require-corp' <<<"$headers" || { echo 'COEP header missing' >&2; exit 1; }
    grep -qi '^cross-origin-opener-policy: same-origin' <<<"$headers" || { echo 'COOP header missing' >&2; exit 1; }
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "https://$DT_HOST/admin")
    [[ $code == 401 ]] || { echo "admin without credentials returned $code, want 401" >&2; exit 1; }
    echo "Deployed $short: $WEB_IMAGE, $FEEDBACK_IMAGE at https://$DT_HOST"
    [[ ${1:-} == --smoke ]] && exec "$repo/deploy/smoke.sh"
    exit 0
  fi
  sleep 5
done
echo 'The public host does not serve this rollout yet' >&2
exit 1
