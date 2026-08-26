
import { createApp } from '../../src/app.js';
import { setupTestServer } from '../helpers/http.js';
import { getInMemoryDb } from '../helpers/prisma-mock.js';
import { resetMemoryRedis } from '../helpers/redis-mock.js';

/**
 * Auth lifecycle integration test - full HTTP stack (helmet, CORS, JSON
 * parsing, Zod validation, Redis-backed rate limiting, error envelope) with
 * the in-memory Prisma double. Covers: signup -> login -> me -> refresh
 * rotation -> logout, plus enumeration-safe failures and validation errors.
 */

jest.mock('../../src/lib/prisma.js', () =>
  require('../helpers/prisma-mock').makePrismaExports(),
);
jest.mock('../../src/lib/redis.js', () => require('../helpers/redis-mock').makeRedisExports());

const app = createApp();
const req = setupTestServer(app);

const SIGNUP = {
  companyName: 'Mama Nkechi Foods',
  fullName: 'Nkechi Okafor',
  email: 'nkechi@wco.test',
  password: 'Sup3rSecret!',
  country: 'NG',
};

beforeEach(() => {
  getInMemoryDb().reset();
  resetMemoryRedis();
});

describe('POST /api/v1/auth/signup', () => {
  it('creates merchant + OWNER user and returns tokens', async () => {
    const res = await req().post('/api/v1/auth/signup').send(SIGNUP);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.merchant.name).toBe('Mama Nkechi Foods');
    expect(res.body.data.user).toMatchObject({ email: SIGNUP.email, role: 'OWNER' });
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
  });

  it('rejects duplicate emails with 409', async () => {
    await req().post('/api/v1/auth/signup').send(SIGNUP);
    const res = await req().post('/api/v1/auth/signup').send({ ...SIGNUP, fullName: 'Copy' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 422 with field details for invalid payloads', async () => {
    const res = await req().post('/api/v1/auth/signup').send({ ...SIGNUP, password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.password).toBeDefined();
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await req().post('/api/v1/auth/signup').send(SIGNUP);
  });

  it('returns a session for valid credentials', async () => {
    const res = await req().post('/api/v1/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(SIGNUP.email);
    expect(res.headers['x-ratelimit-limit']).toBe('10'); // auth bucket is stricter than API default
  });

  it('fails uniformly for unknown emails (no enumeration)', async () => {
    const res = await req()
      .post('/api/v1/auth/login')
      .send({ email: 'who@wco.test', password: 'Whatever123' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/Invalid email or password/);
  });

  it('fails with the same message for wrong passwords', async () => {
    const res = await req()
      .post('/api/v1/auth/login')
      .send({ email: SIGNUP.email, password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/Invalid email or password/);
  });
});

describe('session lifecycle', () => {
  let accessToken: string;
  let refreshToken: string;

  beforeEach(async () => {
    await req().post('/api/v1/auth/signup').send(SIGNUP);
    const login = await req()
      .post('/api/v1/auth/login')
      .send({ email: SIGNUP.email, password: SIGNUP.password });
    accessToken = login.body.data.accessToken;
    refreshToken = login.body.data.refreshToken;
  });

  it('GET /auth/me resolves the JWT without touching credential stores', async () => {
    const res = await req().get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ userId: expect.any(String), role: 'OWNER' });
  });

  it('rotates refresh tokens on use; the old token becomes unusable', async () => {
    const first = await req().post('/api/v1/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    const replay = await req().post('/api/v1/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401); // reuse detection rejects rotated token
  });

  it('logout revokes the session', async () => {
    const out = await req().post('/api/v1/auth/logout').send({ refreshToken });
    expect(out.status).toBe(200);
    const after = await req().post('/api/v1/auth/refresh').send({ refreshToken });
    expect(after.status).toBe(401);
  });

  it('rejects unauthenticated /me requests', async () => {
    const res = await req().get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
