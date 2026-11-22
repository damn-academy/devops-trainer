#!/usr/bin/env bash
# Smoke check of the public site in headless Chromium, run as a Job in the
# cluster (web/scripts/smoke-public.mjs). The admin token stays in the Secret.
set -euo pipefail
cd "$(dirname "$0")/.."
repo=$PWD
source "${SANKOFA_ROOT:-$HOME/projects/sankofa-int}/hack/stand/env.sh"
DT_HOST=${DT_HOST:-damn.academy}
GIT_URL=${GIT_URL:-https://github.com/tym83/devops-trainer}
ns=devops-trainer
sha=$(git rev-parse HEAD)
job=smoke-${sha:0:12}-$(date +%H%M%S)
sed -e "s#JOB_NAME#$job#g" -e "s#'GIT_URL'#'$GIT_URL'#" -e "s#'GIT_SHA'#'$sha'#" -e "s#DT_HOST#$DT_HOST#g" \
  "$repo/deploy/smoke-job.yaml" | km apply -f - >/dev/null
echo "Smoke check in job/$job"
until status=$(km -n $ns get job "$job" -o jsonpath='{.status.succeeded}{.status.failed}') && [[ -n $status ]]; do sleep 10; done
km -n $ns logs "job/$job" --tail=100
[[ $(km -n $ns get job "$job" -o jsonpath='{.status.succeeded}') == 1 ]]
