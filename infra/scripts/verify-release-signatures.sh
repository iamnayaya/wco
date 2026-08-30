#!/usr/bin/env bash
# Verify that every image for the given release SHA is cosign-signed and the
# signatures match. Exit non-zero on any missing/invalid signature.
set -euo pipefail

SHA="${1:?usage: verify-release-signatures.sh <git-sha>}"
REGISTRY="ghcr.io/wco/wco"
APPS=(backend webhook-handler ai-engine frontend)

for app in "${APPS[@]}"; do
  img="${REGISTRY}/${app}:sha-${SHA:0:7}-main"
  echo "==> Verifying signature for ${img}"
  cosign verify \
    --key ./.cosign/wco-pub.pem \
    "${img}" >/dev/null 2>&1 \
    || { echo "::error::Signature missing/invalid for ${img}"; exit 1; }
done

echo "All ${#APPS[@]} images verified."
