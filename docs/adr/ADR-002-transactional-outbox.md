# ADR-002: Transactional outbox over change-data-capture for event delivery

- **Status:** Accepted
- **Date:** 2026-01

## Context

Domain events (order.paid, payment.succeeded) must reach RabbitMQ exactly once per business fact, even when the process dies between the DB write and the publish. Options:

1. **Dual-write** — write DB + publish in one handler. Simple; loses events on crash.
2. **Transactional outbox** — write an `outbox_events` row in the same transaction; a relay publishes and deletes.
3. **CDC (Debezium)** — tail the WAL, publish from Postgres.

## Decision

**Transactional outbox**, relayed by a 500ms poller using `FOR UPDATE SKIP LOCKED`.

## Rationale

- No new infrastructure (Debezium + Kafka Connect + ZooKeeper-class ops burden is a second distributed system).
- Exactly-once *effect* at the consumer via idempotency keys derived from event IDs; at-least-once in transport.
- `SKIP LOCKED` lets us run multiple relay replicas safely from day one.

## Consequences

+ One less vendor/system to operate before Series A scale.
+ Events are inspectable rows — trivially debuggable with SQL.
− ~500ms added latency on event delivery; acceptable for all current consumers (notifications, AI, analytics rollups).
− Relay must be deployed with the API or as its own small deployment (it is).

We will revisit CDC only if event volume makes polling measurably expensive (>10k events/min sustained).
