# Troubleshooting Runbook

Common symptoms and the fastest path to root cause. Start with **SLOs → logs →
metrics → pod state** every time.

## Symptom → likely cause → check

### 1. High 5xx error rate (page alert)
- Cause: bad deploy, DB contention, upstream (payment provider) latency.
- Check: Grafana `Wco Error Rate` panel; `kubectl -n wco-prod get pods`; roll
  back via `kubectl argo rollouts undo backend`.

### 2. p99 latency rising but CPU idle
- Cause: lock contention on DB, Redis hot key, or GC pressure.
- Check: `pg_stat_activity` for long locks; Redis `INFO` for evictions; app
  trace (p99 broken down by endpoint).

### 3. Webhooks not delivered (queue growing)
- Cause: downstream provider throttling, DLQ saturation, auth failure.
- Check: ready messages on RabbitMQ; webhook-handler logs for retries/DLQ.

### 4. Pods CrashLoopBackOff / ImagePullBackOff
- `kubectl -n wco-prod describe pod <pod>` for the exact error.
- ImagePullBackOff → check ECR auth / tag exists (ArgoCD Image Updater tag).
- CrashLoop → `kubectl logs <pod> --previous`; check configmap/env mismatch.

### 5. Service intermittently unreachable
- Check: `kubectl get endpoints <svc>` (no endpoints = selector mismatch);
  NetworkPolicy logs; ALB target health in ingress logs.
- DNS: `nslookup <svc>.<ns>.svc.cluster.local`.

### 6. Secret "NotFound" (ESO)
- Verify SecretStore/ExternalSecret sync:
  ```bash
  kubectl -n wco-prod describe externalsecret <name>
  # Unready → check the AWS secret key path + IRSA role permission
  ```

## Core diagnostic loop (start here)

```bash
# 1. SLOs
kubectl -n wco-observability get prometheusrule wco-slos

# 2. Pods
kubectl -n wco-prod get pods -o wide
kubectl -n wco-prod logs <pod> --tail=200

# 3. Data plane
kubectl -n wco-prod get svc,ep
```

## Rollback triggers (automatic)

- Argo Rollouts analysis fails on error-rate burn → auto-undo to last stable.
- Migration forward-failure → never auto-run destructive migrations; use
  expand/contract with feature flags.
- Deploy verification fails → revert image tag via `argocd app set`.

## Escalation

1. **L1 (on-call):** follow this runbook; page if SLO breach.
2. **L2 (platform):** IAM/infra/Terraform issue.
3. **L3 (engineering):** code defect → fix via normal PR → canary.
