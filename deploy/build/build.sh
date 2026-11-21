#!/usr/bin/env bash
# Runs inside the build Job (deploy/build/job.yaml), one stage per container:
#   build.sh tools   golang image: clone the repo, build the feedback binary and crane
#   build.sh images  Playwright image: build the course with the v86 assets, the
#                    lab image and boot snapshots, assemble both images, push them
# Env: GIT_URL, GIT_SHA, DT_HOST, REGISTRIES (pod IPs of the node-local registry).
set -euo pipefail
work=/work
case $1 in
tools)
  git clone --quiet --filter=blob:none "$GIT_URL" "$work/src"
  git -C "$work/src" checkout --quiet "$GIT_SHA"
  mkdir -p "$work/bin" "$work/feedback/rootfs"
  (cd "$work/src/service/feedback" && CGO_ENABLED=0 GOFLAGS=-trimpath go build -ldflags='-s -w' -o "$work/feedback/rootfs/feedback" .)
  # The lab image embeds the OpenTofu provider `lab` (web/scripts/iac.mjs builds
  # it the same way when Go is on PATH; the Playwright image has no Go).
  version=$(sed -n "s/^export const PROVIDER_VERSION = '\(.*\)';/\1/p" "$work/src/web/scripts/iac.mjs")
  [[ -n $version ]] || { echo "PROVIDER_VERSION not found in web/scripts/iac.mjs" >&2; exit 1; }
  (cd "$work/src/tools/terraform-provider-lab" && CGO_ENABLED=0 GOOS=linux GOARCH=386 go build -trimpath -buildvcs=false \
    -ldflags "-s -w -buildid= -X main.version=$version" -o "dist/linux_386/terraform-provider-lab_v$version" .)
  GOBIN="$work/bin" CGO_ENABLED=0 go install github.com/google/go-containerregistry/cmd/crane@v0.20.3
  ;;
images)
  crane() { "$work/bin/crane" --insecure "$@"; }
  src=$work/src
  cd "$src/web"
  npm ci --no-audit --no-fund
  node scripts/fetch-v86.mjs
  npm run build:lab-image
  npm run build:lab-snapshots
  VITE_FEEDBACK_URL="https://$DT_HOST/api/feedback" npm run build

  # Layers: the v86 images (hundreds of MB) apart from the site, so an
  # unchanged layer is stored once.
  stage=$work/stage
  mkdir -p "$stage/v86/usr/share/nginx/html" "$stage/site/usr/share/nginx/html" "$stage/site/etc/nginx/conf.d"
  cp -R dist/v86 "$stage/v86/usr/share/nginx/html/"
  (cd dist && find . -mindepth 1 -maxdepth 1 ! -name v86 -exec cp -R {} "$stage/site/usr/share/nginx/html/" \;)
  cp "$src/deploy/nginx.conf" "$stage/site/etc/nginx/conf.d/default.conf"
  cp "$src/deploy/headers.conf" "$stage/site/etc/nginx/dt-headers.conf"
  # Precompressed copies for gzip_static (the stock image has no brotli module).
  find "$stage/site/usr/share/nginx/html" "$stage/v86/usr/share/nginx/html/v86" -maxdepth 3 -type f \
    \( -name '*.js' -o -name '*.mjs' -o -name '*.css' -o -name '*.html' -o -name '*.json' -o -name '*.svg' -o -name '*.wasm' -o -name '*.webmanifest' -o -name '*.txt' \) \
    -size +1k -exec gzip -9 -n -k {} +
  node "$src/deploy/stamp.mjs" "$stage/v86" "$stage/site"
  for layer in v86 site; do
    (
      cd "$stage/$layer"
      find . -type d -exec chmod 755 {} +
      find . -type f -exec chmod 644 {} +
      find . -type d -exec touch -h -d '2020-01-01T00:00:00Z' {} +
      find . -mindepth 1 | LC_ALL=C sort | tar --owner=0 --group=0 --numeric-owner --no-recursion -cf "$stage/$layer.tar" -T -
    )
  done
  (cd "$work/feedback/rootfs" && chmod 755 feedback && touch -d '2020-01-01T00:00:00Z' feedback && tar --owner=0 --group=0 --numeric-owner -cf "$work/feedback/layer.tar" feedback)

  set -- $REGISTRIES
  first=$1
  shift
  web="$first:5000/sankofa/devops-trainer-web"
  crane append --platform linux/amd64 -b nginxinc/nginx-unprivileged:1.29-alpine \
    -f "$stage/v86.tar" -f "$stage/site.tar" -t "$web:dev" >/dev/null
  fb="$first:5000/sankofa/devops-trainer-feedback"
  crane append --platform linux/amd64 -b gcr.io/distroless/static-debian12:nonroot \
    -f "$work/feedback/layer.tar" -t "$fb:base" >/dev/null
  crane mutate "$fb:base" --entrypoint /feedback --user 65532:65532 -t "$fb:dev" >/dev/null
  for name in devops-trainer-web devops-trainer-feedback; do
    digest=$(crane digest "$first:5000/sankofa/$name:dev")
    for ip in "$@"; do crane copy "$first:5000/sankofa/$name@$digest" "$ip:5000/sankofa/$name:dev"; done
    echo "IMAGE $name localhost:5000/sankofa/$name@$digest"
  done
  ;;
*) echo "unknown stage $1" >&2; exit 2 ;;
esac
