
import { createApp } from '../../src/app.js';
import { setupTestServer } from '../helpers/http.js';
import { setMemoryDbHealthy } from '../helpers/prisma-mock.js';
import { resetMemoryRedis } from '../helpers/redis-mock.js';

/**
 * Health endpoints - hermetic: run against the real Express stack with the
 * in-memory Prisma/Redis doubles injected via jest.moduleRegistry.
 */

jest.mock('../../src/lib/prisma.js', () =>
  require('../helpers/prisma-mock').makePrismaExports(),
);
jest.mock('../../src/lib/redis.js', () => require('../helpers/redis-mock').makeRedisExports());

const app = createApp();
const req = setupTestServer(app);

beforeEach(() => {
  resetMemoryRedis();
  setMemoryDbHealthy(true);
});

describe('GET /health (liveness)', () => {
  it('returns 200 without touching dependencies', async () => {
    setMemoryDbHealthy(false); // even with deps down, liveness stays green
    const res = await req().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'wco-backend' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});

describe('GET /health/ready (readiness)', () => {
  it('returns 200 when all dependencies respond', async () => {
    const res = await req().get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'postgres', healthy: true }),
        expect.objectContaining({ name: 'redis', healthy: true }),
      ]),
    );
  });

  it('reports degraded (503) with per-dependency detail when Postgres is down', async () => {
    setMemoryDbHealthy(false);
    const res = await req().get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    const pg = res.body.dependencies.find((d: { name: string }) => d.name === 'postgres');
    expect(pg.healthy).toBe(false);
  });
});

describe('unknown routes', () => {
  it('return the canonical 404 envelope', async () => {
    const res = await req().get('/api/v1/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });
});
