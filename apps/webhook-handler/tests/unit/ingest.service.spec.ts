import { IngestService } from '../../src/services/ingest.service';

describe('IngestService dedupe', () => {
  const makeRedis = () => {
    const store = new Map<string, string>();
    return {
      store,
      set: jest.fn(async (key: string, _val: string, _mode: string, _ttl: number, nx: string) => {
        if (nx !== 'NX') return null;
        if (store.has(key)) return null;
        store.set(key, '1');
        return 'OK';
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
    };
  };

  const channel = { publish: jest.fn() } as never;
  const makeIngest = (redis: unknown) =>
    new IngestService(redis as never, () => channel);

  it('claims a fresh key and collapses duplicates', async () => {
    const redis = makeRedis();
    const ingest = makeIngest(redis);

    expect(await ingest.acquireDedupeKey('wa:MSG-1')).toBe(true);
    expect(await ingest.acquireDedupeKey('wa:MSG-1')).toBe(false);
  });

  it('publishes to the domain exchange with persistent flag', async () => {
    const publish = jest.fn();
    const ingest = new IngestService(makeRedis() as never, () => ({ publish }) as never);

    await ingest.publish('message.received', { hello: 'world' });

    expect(publish).toHaveBeenCalledWith(
      expect.any(String),
      'message.received',
      expect.any(Buffer),
      expect.objectContaining({ persistent: true }),
    );
    const payload = JSON.parse(publish.mock.calls[0][2].toString());
    expect(payload.hello).toBe('world');
    expect(payload.ingestedAt).toBeDefined();
  });

  it('releases keys when publish fails upstream', async () => {
    const redis = makeRedis();
    const ingest = makeIngest(redis);

    await ingest.acquireDedupeKey('psp:PAYSTACK:tx-9');
    await ingest.releaseDedupeKey('psp:PAYSTACK:tx-9');
    expect(await ingest.acquireDedupeKey('psp:PAYSTACK:tx-9')).toBe(true);
  });
});
