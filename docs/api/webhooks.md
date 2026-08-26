# Webhooks

> Two directions, one document. **Inbound**: providers (Meta, PSPs, logistics) → WCO.
> **Outbound**: WCO → merchant systems. Both are HMAC-verified, replay-protected,
> and processed at-least-once with idempotent handlers.

---

## 1. Inbound webhooks (providers → WCO)

### 1.1 Public routes

| Provider | Path | Signature header | Verification |
|---|---|---|---|
| Meta WhatsApp Cloud | `POST /api/v1/webhooks/inbound/whatsapp` | `X-Hub-Signature-256: sha256=…` | HMAC-SHA256(rawBody, appSecret); GET handshake echoes `hub.challenge` |
| Paystack | `POST /api/v1/webhooks/inbound/paystack` | `x-paystack-signature` | HMAC-SHA512(rawBody, secretKey) |
| Flutterwave | `POST /api/v1/webhooks/inbound/flutterwave` | `verif-hash` | constant-time token equality |
| OPay | `POST /api/v1/webhooks/inbound/opay` | `x-opay-signature` | HMAC-SHA256 |
| GIG / Kwik / Sendy | `POST /api/v1/webhooks/inbound/logistics/{provider}` | provider-specific | shared-secret or HMAC per adapter |

Routing note: these paths live on the **webhook-handler** service (:4002), not
backend-api — ingestion must survive core-API deploys. The user-listed convenience
paths (`POST /payments/webhooks`, `/subscriptions/webhooks`, `/whatsapp/webhooks`)
are 301-mapped to the canonical inbound paths above.

### 1.2 Processing pipeline

```mermaid
sequenceDiagram
    participant P as Provider
    participant W as webhook-handler
    participant D as PostgreSQL
    participant Q as RabbitMQ
    P->>W: POST raw payload + signature
    W->>W: verify HMAC over raw bytes (constant-time)
    alt invalid signature
        W-->>P: 401 (no detail leak)
    end
    W->>D: INSERT raw_webhook_events(payload, provider, eventId) — dedupe key
    alt duplicate eventId
        W-->>P: 200 (already stored)
    else new
        W->>Q: publish ingest.{provider}
        W-->>P: 200 within <100ms
        Note over Q: consumer processes; updates domain rows + outbox events
    end
```

Properties: ack-fast/persist-first (provider retries stop early), idempotent consumers
(dedupe on provider eventId), poison payloads quarantined to `raw_webhook_events.status='dead'`
with alert, 72 h raw retention for replay tooling.

## 2. Outbound webhooks (WCO → merchants)

### 2.1 Subscribing

```http
POST /api/v1/webhooks
Authorization: Bearer …   X-Store-Id: str_…
{
  "url": "https://partner.example.com/hooks/wco",
  "events": ["order.paid", "order.delivered", "payment.failed"],
  "description": "ERP sync"
}
→ 201 { "id": "wh_...", "secret": "whsec_9f2c…" }   // secret shown exactly once
```

Empty `events` array = all events. Event catalog mirrors the outbox routing keys
(`packages/shared/src/events`). Delivery = HTTPS POST JSON, 10 s timeout.

### 2.2 Signature scheme

```
X-WCO-Signature: t=1769856000,v1=5257a869e7…
v1 = HMAC_SHA256(secret, `${t}.${rawRequestBody}`)
```

Receiver pseudocode:

```python
expected = hmac.new(secret, f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
assert hmac.compare_digest(expected, v1) and abs(now - int(t)) < 300
```

Tolerance ±5 min blocks replay; rotate via `POST /webhooks/:id/rotate` (old secret
honored 24 h for zero-downtime rotation).

### 2.3 Retry & failure policy

| Attempt schedule | Trigger |
|---|---|
| t+0, +30 s, +2 m, +10 m, +1 h, +6 h, +24 h (7 attempts) | non-2xx / timeout |
| auto-disable + owner email | 30 consecutive endpoint failures |
| manual re-enable | `PUT /webhooks/:id { isActive: true }` |

Delivery attempts are logged (`webhook_delivery_logs`: status, latency, response bytes ≤4 KB);
`POST /webhooks/:id/test` fires a synthetic event through the real pipeline and returns
the delivery result synchronously.

### 2.4 Payload envelope

```json
{
  "eventId": "evt_01HQ...",          // idempotency key for receivers
  "type": "order.paid",
  "createdAt": "2026-02-01T12:00:04Z",
  "storeId": "str_...",
  "data": { "orderId": "ord_...", "total": "1500.50", "currency": "NGN" }
}
```

Contract: receivers MUST treat unknown `type`s as no-op and dedupe on `eventId`.
Payloads reference ids; fetch full state via REST/GraphQL (avoids schema drift coupling).

## 3. Operational runbook pointers

- Replay tool: `tools/scripts/replay-webhook.ts --event evt_… --endpoint …` re-signs and re-sends any stored event.
- Backfill after outage: relay drains queued outbound events preserving order per subscription.
- Monitoring: success rate, p95 delivery latency, dead-letter count — alerts in observability.md §5.
