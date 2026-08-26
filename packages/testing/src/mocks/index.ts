/**
 * Lightweight in-memory fakes for infrastructure dependencies.
 * Unit tests must never touch real Redis/RabbitMQ — these fakes keep the
 * test suite fast, hermetic and parallel-safe.
 */

export class RedisFake {
  private store = new Map<string, string>();
  private expiries = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    this.evict(key);
    return this.store.get(key) ?? null;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    this.store.set(key, value);
    this.expiries.set(key, Date.now() + ttlSeconds * 1000);
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    this.expiries.delete(key);
  }

  async incr(key: string): Promise<number> {
    const next = Number(this.store.get(key) ?? '0') + 1;
    this.store.set(key, String(next));
    return next;
  }

  private evict(key: string): void {
    const expiry = this.expiries.get(key);
    if (expiry && expiry < Date.now()) {
      this.store.delete(key);
      this.expiries.delete(key);
    }
  }
}

export class RabbitPublisherFake {
  readonly published: Array<{ exchange: string; routingKey: string; payload: unknown }> = [];

  async publish(exchange: string, routingKey: string, payload: object): Promise<void> {
    this.published.push({ exchange, routingKey, payload: JSON.parse(JSON.stringify(payload)) });
  }

  eventsOfType(type: string): Array<Record<string, unknown>> {
    return this.published
      .filter((p) => (p.payload as { eventType?: string }).eventType === type)
      .map((p) => p.payload as Record<string, unknown>);
  }
}
