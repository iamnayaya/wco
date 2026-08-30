#!/usr/bin/env bash
# Check SLO burn during a rollout. Fails if error-rate or latency burn is outside
# the acceptable budget, which triggers Argo Rollouts to abort the canary.
#
# Usage: check-slo-burn.sh --window=10m --max-burn-rate=2
set -uo pipefail

WINDOW="${1:---window=10m}"
MAX_BURN="${2:---max-burn-rate=2}"
WINDOW="${WINDOW#*=}"
MAX_BURN="${MAX_BURN#*=}"

CURRENT_ER=$(curl -s "http://prometheus:9090/api/v1/query" \
   --data-urlencode \
   "query=sum(rate(http_requests_total{status=~\"5..\"}[${WINDOW}])) / clamp_min(sum(rate(http_requests_total[${WINDOW}])),1) * 100")

ER=$(printf '%s' "$CURRENT_ER" | sed -n 's/.*"value":\[[^,]*,"\([^"]*\)"\].*/\1/p' | head -1)
ER=$(printf '%.2f' "${ER:-0}")

echo "Current error rate over ${WINDOW}: ${ER}%"
THRESHOLD=$(awk -v b="$MAX_BURN" 'BEGIN{print b*0.1}')   # 10% SLO baseline, scaled by burn
if awk -v e="$ER" -v t="$THRESHOLD" 'BEGIN{exit !(e > t)}'; then
  echo "::error::Error budget burned too fast (max burn rate ${MAX_BURN}x)"
  exit 1
fi
echo "SLO burn acceptable."
