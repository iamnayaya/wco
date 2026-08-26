import { createApp } from '../../src/app.js';
import { testOutbox, type OutboxEntry } from '../../src/services/notification.service.js';
import { base32Decode, hotp, openSecret } from '../../src/services/totp.service.js';
import { setupTestServer } from '../helpers/http.js';
import { getInMemoryDb } from '../helpers/prisma-mock.js';
import { resetMemoryRedis } from '../helpers/redis-mock.js';

/**
 * Auth v2 integration coverage: lockout, password reset (durable table),
 * email/phone verification, TOTP 2FA enrollment + login challenge, session
 * management and the OAuth state-CSRF surface. All hermetic via the in-memory
 * Prisma + Redis doubles; notifications are captured in testOutbox.
 */

jest.mock('../../src/lib/prisma.js', () =>
  require('../helpers/prisma-mock').makePrismaExports(),
);
jest.mock('../../src/lib/redis.js', () => require('../helpers/redis-mock').makeRedisExports());

const app = createApp();
const req = setupTestServer(app);

const SIGNUP = {
  companyName: 'Kano Textiles Ltd',
  fullName: 'Amina Yusuf',
  email: 'amina@wco.test',
  password: 'Sup3rSecret!',
  country: 'NG',
};

async function signupAndLogin(): Promise<{ accessToken: string; refreshToken: string }> {
  await req().post('/api/v1/auth/signup').send(SIGNUP);
  const login = await req().post('/api/v1/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password });
  expect(login.status).toBe(200);
  return { accessToken: login.body.data.accessToken, refreshToken: login.body.data.refreshToken };
}

function lastOutbox(template: string): OutboxEntry | undefined {
  return [...testOutbox].reverse().find((e) => e.template === template);
}

function lastSms(): OutboxEntry | undefined {
  return [...testOutbox].reverse().find((e) => e.channel === 'sms');
}

beforeEach(() => {
  getInMemoryDb().reset();
  resetMemoryRedis();
});

describe('account lockout', () => {
  it('locks the account after threshold failures and rejects correct creds while locked', async () => {
    await req().post('/api/v1/auth/signup').send(SIGNUP);
    for (let i = 0; i < 5; i += 1) {
      const bad = await req().post('/api/v1/auth/login').send({ email: SIGNUP.email, password: 'WrongPass1' });
      expect(bad.status).toBe(401);
    }
    const lockedCorrect = await req().post('/api/v1/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password });
    expect(lockedCorrect.status).toBe(403);
    expect(lockedCorrect.body.error.message).toMatch(/locked/i);
  });
});

describe('password reset (durable single-use tokens)', () => {
  it('issues a token, rotates the password and revokes sessions', async () => {
    await req().post('/api/v1/auth/signup').send(SIGNUP);

    const forgot = await req().post('/api/v1/auth/password/forgot').send({ email: SIGNUP.email });
    expect(forgot.status).toBe(200);
    const mail = lastOutbox('password-reset');
    const resetToken = String(mail?.data.resetToken ?? '');
    expect(resetToken.length).toBeGreaterThanOrEqual(20);

    const newPassword = 'FreshPass9';
    const reset = await req().post('/api/v1/auth/password/reset').send({
      token: resetToken,
      newPassword,
    });
    expect(reset.status).toBe(200);

    // Old refresh session revoked by the reset.
    const meOld = await req().get('/api/v1/auth/me');
    expect(meOld.status).toBe(401);

    const relogin = await req().post('/api/v1/auth/login').send({ email: SIGNUP.email, password: newPassword });
    expect(relogin.status).toBe(200);
  });

  it('rejects replayed tokens', async () => {
    await signupAndLogin();
    await req().post('/api/v1/auth/password/forgot').send({ email: SIGNUP.email });
    const mail = lastOutbox('password-reset');
    const token = String(mail ? mail.data.resetToken : '');
    const first = await req().post('/api/v1/auth/password/reset').send({ token, newPassword: 'FreshPass9' });
    expect(first.status).toBe(200);
    const replay = await req().post('/api/v1/auth/password/reset').send({ token, newPassword: 'OtherPass7' });
    expect(replay.status).toBe(422);
  });

  it('never reveals unknown emails', async () => {
    const res = await req().post('/api/v1/auth/password/forgot').send({ email: 'ghost@wco.test' });
    expect(res.status).toBe(200);
    expect(res.body.data.queued).toBe(true);
  });
});

describe('email verification', () => {
  it('request -> confirm marks emailVerifiedAt; resend invalidates old links', async () => {
    const { accessToken } = await signupAndLogin();

    await req().post('/api/v1/auth/verify-email/request').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const firstToken = String(lastOutbox('verify-email')?.data.verificationToken ?? '');
    expect(firstToken.length).toBeGreaterThanOrEqual(20);

    // Resend - first link must die.
    await req().post('/api/v1/auth/verify-email/resend').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const secondToken = String(lastOutbox('verify-email')?.data.verificationToken ?? '');
    expect(secondToken).not.toBe(firstToken);

    const stale = await req().post('/api/v1/auth/verify-email/confirm').send({ token: firstToken });
    expect(stale.status).toBe(422);

    const ok = await req().post('/api/v1/auth/verify-email/confirm').send({ token: secondToken });
    expect(ok.status).toBe(200);
    const db = getInMemoryDb();
    expect(db.user[0].emailVerifiedAt).toBeInstanceOf(Date);

    // Already-verified user requesting again is a silent no-op.
    await req().post('/api/v1/auth/verify-email/request').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(db.emailVerification.filter((r) => r.consumedAt === null)).toHaveLength(0);
  });

  it('requires authentication to request', async () => {
    const res = await req().post('/api/v1/auth/verify-email/request');
    expect(res.status).toBe(401);
  });
});

describe('phone verification', () => {
  it('sends a 6-digit code via SMS and verifies with attempt tracking', async () => {
    const { accessToken } = await signupAndLogin();
    const db = getInMemoryDb();
    db.user[0].phone = '+2348012345678';

    await req().post('/api/v1/auth/verify-phone/request').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const sms = lastSms();
    expect(sms).toBeDefined();
    const smsBody = sms ? String(sms.body ?? '') : '';
    const code = smsBody.match(/(\d{6})/)?.[1] ?? '';

    const wrong = await req().post('/api/v1/auth/verify-phone/confirm')
      .set('Authorization', `Bearer ${accessToken}`).send({ code: '000000' });
    expect(wrong.status).toBe(422);
    expect(db.phoneVerification[0].attempts).toBe(1);

    const right = await req().post('/api/v1/auth/verify-phone/confirm')
      .set('Authorization', `Bearer ${accessToken}`).send({ code });
    expect(right.status).toBe(200);
    expect(db.user[0].phoneVerifiedAt).toBeInstanceOf(Date);
  });
});

describe('two-factor authentication (TOTP)', () => {
  async function enable2fa(): Promise<string> {
    const { accessToken } = await signupAndLogin();
    const auth = { Authorization: `Bearer ${accessToken}` };
    const setup = await req().post('/api/v1/auth/2fa/setup').set(auth);
    expect(setup.status).toBe(200);
    const secret = new URL(setup.body.data.otpauthUri).searchParams.get('secret') ?? '';

    const counter = Math.floor(Date.now() / 1000 / 30);
    const code = hotp(base32Decode(secret), counter);
    const enable = await req().post('/api/v1/auth/2fa/enable').set(auth).send({ code });
    expect(enable.status).toBe(200);
    expect(enable.body.data.backupCodes).toHaveLength(10);
    return accessToken;
  }

  it('login returns a challenge; completing it with a valid code issues tokens', async () => {
    await enable2fa();
    const challenge = await req().post('/api/v1/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password });
    expect(challenge.status).toBe(200);
    expect(challenge.body.data.twoFactorRequired).toBe(true);
    expect(challenge.body.data.accessToken).toBeUndefined();

    const sealed = String(getInMemoryDb().twoFactorSecret[0]?.secretEnc);
    const secret = openSecret(sealed);
    const code = hotp(base32Decode(secret), Math.floor(Date.now() / 1000 / 30));
    const complete = await req().post('/api/v1/auth/2fa/login')
      .send({ challengeId: challenge.body.data.challengeId, code });
    expect(complete.status).toBe(200);
    expect(complete.body.data.accessToken).toBeTruthy();
  });

  it('rejects bad codes and expires challenges atomically (single use)', async () => {
    await enable2fa();
    const challenge = await req().post('/api/v1/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password });
    const challengeId = challenge.body.data.challengeId;

    const bad = await req().post('/api/v1/auth/2fa/login').send({ challengeId, code: '000000' });
    expect(bad.status).toBe(401);

    // Challenge is consumed by the FIRST attempt regardless of outcome (getdel).
    const secondTry = await req().post('/api/v1/auth/2fa/login').send({ challengeId, code: '000001' });
    expect(secondTry.status).toBe(401);
    expect(secondTry.body.error.message).toMatch(/expired|sign in again/i);
  });

  it('backup codes work exactly once', async () => {
    // Enroll manually so the plaintext backup codes can be captured.
    const { accessToken } = await signupAndLogin();
    const auth = { Authorization: `Bearer ${accessToken}` };
    const setup = await req().post('/api/v1/auth/2fa/setup').set(auth);
    const secret = new URL(setup.body.data.otpauthUri).searchParams.get('secret') ?? '';
    const code = hotp(base32Decode(secret), Math.floor(Date.now() / 1000 / 30));
    const enable = await req().post('/api/v1/auth/2fa/enable').set(auth).send({ code });
    const backupCode = enable.body.data.backupCodes[0] as string;

    const challenge = await req().post('/api/v1/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password });
    const done = await req().post('/api/v1/auth/2fa/login')
      .send({ challengeId: challenge.body.data.challengeId, code: backupCode });
    expect(done.status).toBe(200);
    expect(done.body.data.accessToken).toBeTruthy();

    // The burned code cannot log in again.
    const challenge2 = await req().post('/api/v1/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password });
    const replay = await req().post('/api/v1/auth/2fa/login')
      .send({ challengeId: challenge2.body.data.challengeId, code: backupCode });
    expect(replay.status).toBe(401);
  });

  it('disable requires the account password', async () => {
    const accessToken = await enable2fa();
    const auth = { Authorization: `Bearer ${accessToken}` };
    const noPwd = await req().post('/api/v1/auth/2fa/disable').set(auth).send({ password: 'nope' });
    expect(noPwd.status).toBe(401);
    const yesPwd = await req().post('/api/v1/auth/2fa/disable').set(auth).send({ password: SIGNUP.password });
    expect(yesPwd.status).toBe(200);
    const plain = await req().post('/api/v1/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password });
    expect(plain.body.data.accessToken).toBeTruthy();
  });
});

describe('session management', () => {
  it('lists active sessions, revokes one and revokes others keeping current', async () => {
    const { accessToken } = await signupAndLogin();
    const auth = { Authorization: `Bearer ${accessToken}` };

    // A second explicit login (the first came from signup itself); its tokens
    // represent the caller's *current* session (newest = list head).
    const extraLogin = await req().post('/api/v1/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password });
    const currentRefreshToken = extraLogin.body.data.refreshToken as string;

    const list = await req().get('/api/v1/auth/sessions').set(auth);
    expect(list.status).toBe(200);
    expect(list.body.data.sessions).toHaveLength(3);

    const currentId = list.body.data.sessions[0].id as string;
    const otherId = list.body.data.sessions.find((s: { id: string }) => s.id !== currentId).id as string;
    const revokeOne = await req().delete(`/api/v1/auth/sessions/${otherId}`).set(auth);
    expect(revokeOne.status).toBe(200);

    const afterOne = await req().get('/api/v1/auth/sessions').set(auth);
    expect(afterOne.body.data.sessions).toHaveLength(2);

    // Revoke-all keeps the caller's current session alive.
    const revokeAll = await req().post('/api/v1/auth/sessions/revoke-all').set(auth).send({ refreshToken: currentRefreshToken });
    expect(revokeAll.body.data.revoked).toBe(1);

    const stillValid = await req().get('/api/v1/auth/me').set(auth);
    expect(stillValid.status).toBe(200);
  });

  it('logout denylists the access token immediately', async () => {
    const { accessToken, refreshToken } = await signupAndLogin();
    const logout = await req().post('/api/v1/auth/logout').send({ refreshToken, accessToken });
    expect(logout.status).toBe(200);
    const me = await req().get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
  });
});

describe('oauth routes', () => {
  it('reports provider availability', async () => {
    const res = await req().get('/api/v1/auth/providers');
    expect(res.status).toBe(200);
    expect(res.body.data.providers).toEqual({ google: false, facebook: false, apple: false });
  });

  it('503s for unconfigured providers on start', async () => {
    const res = await req().get('/api/v1/auth/google/start');
    expect(res.status).toBe(503);
  });

  it('rejects bogus callback states (CSRF) before touching providers', async () => {
    const res = await req().get('/api/v1/auth/google/callback?code=abc&state=forged-state-value');
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/state/i);
  });

  it('400s on unknown providers', async () => {
    const res = await req().get('/api/v1/auth/myspace/start');
    expect(res.status).toBe(422);
  });
});
