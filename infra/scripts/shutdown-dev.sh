#!/usr/bin/env bash
# Nightly cost saver for the dev environment: scale workloads to 0 replicas
# when not in use, and restore flag on next run.
# Usage: shutdown-dev.sh [--restore]
set -uo pipefail

NS="wco-dev"
AUTO=0
if [[ "${1:-}" == "--restore" ]]; then AUTO=1; fi

scale() {
  local deploy=$1 replicas=$2
  kubectl -n "$NS" scale deployment/"$deploy" --replicas="$replicas" || true
}

if [[ "$AUTO" == "0" ]]; then
  echo "Scaling down dev cluster outside of hours..."
  for d in backend webhook-handler ai-engine frontend admin-dashboard; do
    scale "$d" 0
  done
  scale "backend-worker" 0
else
  echo "Restoring dev cluster..."
  scale "backend" 1
  scale "frontend" 1
  scale "webhook-handler" 1
  scale "ai-engine" 0   # AI dev can be on-demand only
fi
echo "Done."
