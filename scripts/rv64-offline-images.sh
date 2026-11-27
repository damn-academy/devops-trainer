#!/usr/bin/env bash
# Run only inside rv64-dev. These are riscv64 platform manifests, not moving tags.
set -euo pipefail
[[ ${CARGO_HOME:-} == /work/cargo ]]
out=/work/guest/kuberoot/root/usr/share/kuberoot/rv64-images
mkdir -p "$out"
skopeo copy --override-arch riscv64 docker://docker.io/coredns/coredns@sha256:7efd62b628180681ba96ed3a0c1a1311b976f8d1cc61159f4b2dc80a83583e16 "docker-archive:$out/coredns.tar:docker.io/coredns/coredns:1.13.1"
skopeo copy --override-arch riscv64 docker://docker.io/rancher/local-path-provisioner@sha256:760110b2836a165df77b1641e554b2155f41c4df798ff667db61c877f402a326 "docker-archive:$out/local-path.tar:docker.io/rancher/local-path-provisioner:v0.0.32"
skopeo copy --override-arch riscv64 docker://docker.io/library/busybox@sha256:be2e8702261d743f7b1ba1b1cb4499927664d7a82baedf87564306426dda680a "docker-archive:$out/busybox.tar:docker.io/library/busybox:1.37.0"
sha256sum "$out"/*.tar
