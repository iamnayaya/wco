/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * In-memory Redis double for hermetic integration tests.
 *
 * Implements exactly the surface the app touches in tested flows: the
 * rate-limiter pipeline (INCR+PEXPIRE), cache get/set/del, and PING health.
 * TTL semantics are approximated (entries expire lazily on read).
 */

interface Entry {
  value: string;
  expiresAt: number | null;
}

const store = new Map<string, Entry>();
let healthy = true;

function live(entry: Entry | undefined): entry is Entry {
  if (!entry) return false;
  if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
    return false; // lazy expiry
  }
  return true;
}

export function resetMemoryRedis(): void {
  store.clear();
  healthy = true;
}

export function setMemoryRedisHealthy(value: boolean): void {
  healthy = value;
}

type Cmd = [op: 'incr' | 'pexpire', ...args: unknown[]];

export function createMemoryRedis(): any {
  const client = {
    async get(key: string): Promise<string | null> {
      const e = store.get(key);
      return live(e) ? e.value : null;
    },
    async getdel(key: string): Promise<string | null> {
      const v = await client.get(key);
      store.delete(key);
      return v;
    },
    async set(key: string, value: string, ...rest: unknown[]): Promise<unknown> {
      // Supports: SET k v EX ttl [, NX]
      let ttlMs: number | null = null;
      let nx = false;
      for (let i = 0; i < rest.length; i += 1) {
        const flag = String(rest[i]).toUpperCase();
        if (flag === 'EX') ttlMs = Number(rest[i + 1]) * 1000;
        if (flag === 'NX') nx = true;
      }
      if (nx && live(store.get(key))) return null;
      store.set(key, { value, expiresAt: ttlMs === null ? null : Date.now() + ttlMs });
      return 'OK';
    },
    async setex(key: string, seconds: number, value: string): Promise<unknown> {
      store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
      return 'OK';
    },
    async del(...keys: string[]): Promise<number> {
      let n = 0;
      for (const k of keys) if (store.delete(k)) n += 1;
      return n;
    },
    async incr(key: string): Promise<number> {
      const current = Number((await client.get(key)) ?? 0);
      const next = current + 1;
      const existing = store.get(key);
      store.set(key, { value: String(next), expiresAt: existing && live(existing) ? existing.expiresAt : null });
      return next;
    },
    async expire(key: string, seconds: number): Promise<number> {
      return client.pexpire(key, seconds * 1000);
    },
    async pexpire(key: string, ms: number): Promise<number> {
      const e = store.get(key);
      if (!e) return 0;
      e.expiresAt = Date.now() + ms;
      return 1;
    },
    async ttl(): Promise<number> {
      return -1;
    },
    async ping(): Promise<string> {
      if (!healthy) throw new Error('ECONNREFUSED');
      return 'PONG';
    },
    pipeline() {
      const cmds: Cmd[] = [];
      return {
        incr(key: string) {
          cmds.push(['incr', key]);
          return this;
        },
        pexpire(key: string, ms: number) {
          cmds.push(['pexpire', key, ms]);
          return this;
        },
        async exec(): Promise<Array<[null, unknown]>> {
          const results: Array<[null, unknown]> = [];
          for (const [op, ...args] of cmds) {
            results.push([null, await (client as any)[op](...(args))]);
          }
          return results;
        },
      };
    },
    scanStream({ match }: { match?: string } = {}) {
      const { EventEmitter } = require('node:events');
      const stream = new EventEmitter();
      // Glob is translated to a regex with every metacharacter escaped first.
      const regex = match
        ? // eslint-disable-next-line security/detect-non-literal-regexp
          new RegExp(`^${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`)
        : null;
      setImmediate(() => {
        const keys = [...store.keys()].filter((k) => (regex ? regex.test(k) : true));
        if (keys.length > 0) stream.emit('data', keys);
        stream.emit('end');
      });
      return stream;
    },
  };
  return client;
}

/** Factory consumed inside jest.mock('.../lib/redis.js') hoisted factories. */
export function makeRedisExports(): Record<string, unknown> {
  let singleton: any = null;
  return {
    getRedis: () => (singleton ??= createMemoryRedis()),
    checkRedisHealth: async () => healthy,
    disconnectRedis: () => {
      singleton = null;
    },
  };
}
