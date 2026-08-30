# Runbook: Queue

Operating RabbitMQ: monitoring backlogs, draining, handling dead letters / poison messages, and clearing queues. WCO uses queues for async jobs (outbox relay, AI processing, notifications, webhooks).

## Prerequisites
- RabbitMQ management UI (`http://<host>:15672`) or `rabbitmqadmin` CLI.
- Understanding of the queue/outbox design ([ADR-002](../adr/ADR-002-transactional-outbox.md)).

## 1. Monitor queue health

Metrics per exchange/queue: **queue depth (ready+unacked)**, **consumer count**, **publish/consume rates**, **dead letters**.

Key signals:
| Signal | Meaning | Action |
|---|---|---|
| Queue depth growing | producers outpacing consumers | scale consumers / check consumer errors |
| Unacked messages high | consumer stuck / slow (no ack) | restart consumer, fix timeout |
| Dead-letter queue growing | poison messages | inspect payload, fix/remove, requeue |
| Consumers 0 | worker down | restart workers ([Scaling runbook](./05-scaling-runbook.md)) |

## 2. Check a queue's depth & consumers

```bash
rabbitmqadmin -H <host> -u <user> -p <pass> \
  list queues name messages ready messages_unacknowledged consumers
```

## 3. Drain a backlog

1. Confirm consumers are healthy and the app is up.
2. Scale up consumers temporarily:
   ```bash
   kubectl -n wco-prod scale deployment <worker> --replicas=<N>
   ```
3. Watch depth drop; SQL below to confirm:
   ```bash
   rabbitmqadmin ... list queues name messages
   ```
4. Scale back down after normalized.

## 4. Handle dead letters / poison messages

Poison messages (payloads that always fail) accumulate in the dead-letter queue (DLQ):

1. Inspect the DLQ:
   ```bash
   rabbitmqadmin ... get queue=<dlq> ackmode=reject_requeue_false count=10
   ```
2. Identify the failing message (serialize/validation/unknown provider).
3. **Fix forward:** correct the consumer/validation; or
4. **Remove** genuinely bad messages deliberately (with a record), or **requeue** valid ones:
   ```bash
   rabbitmqadmin ... requeue --vhost=/ <dlq>
   ```
> Never blindly purge — first confirm no valid messages are lost. Record any purge in the ops log.

## 5. Clear a queue (deliberate only)

```bash
rabbitmqadmin ... purge queue name=<queue>
```
Only after confirming the backlog is safe to drop (e.g., retriable events or a corrupted flood). Validate blast radius with the owning squad.

## 6. Restart a dead consumer

```bash
kubectl -n wco-prod rollout restart deploy <consumer>
```
Confirm the consumer reconnects (`consumers` > 0) and starts acks.

## 7. Escalation
- Backlog causing user-visible delay (e.g., messages/AI replies not delivered) → [Incident response runbook](./03-incident-response-runbook.md).
- Persistent poison-message loop → involve the owning squad + [QA defect process](../qa/process.md).
- Capacity ceiling → [Scaling runbook](./05-scaling-runbook.md) (queue section).
