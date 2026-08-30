# Cost Management Runbook

Goal: predictable spend up to the **$50k/mo production budget**, with the
ability to triage the biggest line items in minutes.

## Where the money goes (typical WCO mix)

| Category     | Share | Primary levers |
|--------------|-------|----------------|
| Compute (EKS)| ~45%  | Spot %, instance families, HPA bounds |
| RDS          | ~20%  | Instance class, storage type, PIOPS |
| Data (S3/CDN/Redis/MQ) | ~20% | Lifecycle, CacheCluster sizing, transfer |
| Network/Edge | ~10%  | NAT, CloudFront price class, data transfer |
| Observability| ~5%   | 1 Loki replica, retention, Datadog usage |

## 1. Right-sizing compute

- Backend/admin/async-critical → **on-demand** with HPA across 3–12.
- webhook-handler, ai-engine → **spot** (m5/c5 families) with interruption
  handling via node drain + priority class.
- Purge idle capacity on `dev` nightly (see `scripts/shutdown-dev.sh`).

## 2. Storage & data lifecycle

- S3 → **STANDARD_IA after 30 days**, expire `exports/` after 30 days.
- RDS → daily snapshots, PITR 35 days; archive >1yr to `S3` cold.
- Redis → right-size to working set, avoid oversized clusters.
- Loki → 30-day retention, single replica, `filesystem` backend.

## 3. Network & edge

- CloudFront `PriceClass_100` (Africa/EU) unless global reach justifies more.
- Prefer ALB + CloudFront over per-AZ direct exposure to cut transfer.
- Watch NAT Gateway data processing (per-GB) — route east-west internally.

## 4. Budgets & alerts (automated)

- `aws_budgets_budget` in the security module: **$50k** threshold with **80%**
  and **100%** notifications → SNS → email.
- CloudWatch cost anomaly detection on the `AWS/Billing` namespace; page on
  > 15% week-over-week growth.

## 5. Quarterly savings review

1. Query `Cost Explorer` per service + per label (`wco:env`, `wco:app`).
2. Attack the top-3 line items.
3. Renegotiate RIs/SP for stable on-demand workloads (RDS, MQ, Redis).
4. Remove abandoned `dev` clusters and unused snapshots.

## 6. Emergency cost reduction (incident)

1. Scale HPA max → min and drop spot-to-on-demand ratio to 0.
2. Reduce RDS to a Multi-AZ single-class minimum.
3. Lower Loki retention to 7 days; disable Datadog sampling.
4. Consider CloudFront price-class downgrade if acceptable.
