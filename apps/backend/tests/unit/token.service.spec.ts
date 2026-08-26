import { TokenService, msFromTimeString } from '../../src/services/token.service.js';
import { hashToken } from '../../src/utils/crypto.js';

/**
 * Token lifecycle unit tests - no infra: JWT signing is local and refresh
 * tokens are pure randomness + sha256.
 */
describe('TokenService', () => {
  const service = new TokenService();
  const payload = {
    sub: 'user_1',
    merchantId: 'mrc_1',
    role: 'OWNER' as const,
    email: 'owner@wco.test',
  };

  describe('access tokens', () => {
    it('round-trips claims through sign/verify', () => {
      const token = service.signAccessToken(payload);
      const decoded = service.verifyAccessToken(token);
      expect(decoded.sub).toBe('user_1');
      expect(decoded.merchantId).toBe('mrc_1');
      expect(decoded.role).toBe('OWNER');
      expect(decoded.email).toBe('owner@wco.test');
      expect(decoded.typ).toBe('access');
    });

    it('rejects garbage tokens', () => {
      expect(() => service.verifyAccessToken('not-a-jwt')).toThrow();
    });

    it('rejects tokens signed with the wrong secret', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const jwt = require('jsonwebtoken');
      const forged = jwt.sign({ ...payload, typ: 'access' }, 'a-different-secret-value-at-least-32-chars', {
        expiresIn: '5m',
      });
      expect(() => service.verifyAccessToken(forged)).toThrow();
    });
  });

  describe('refresh tokens', () => {
    it('mints unique opaque tokens with matching hashes', () => {
      const a = service.mintRefreshToken();
      const b = service.mintRefreshToken();
      expect(a.raw).not.toBe(b.raw);
      expect(a.tokenHash).toBe(hashToken(a.raw));
      expect(a.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('hashes consistently for rotation checks', () => {
      const minted = service.mintRefreshToken();
      expect(service.hashRefreshToken(minted.raw)).toBe(minted.tokenHash);
    });
  });

  describe('password reset tokens', () => {
    it('expire within 15 minutes', () => {
      const minted = service.mintPasswordResetToken();
      const ttlMs = minted.expiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan(14 * 60_000);
      expect(ttlMs).toBeLessThanOrEqual(15 * 60_000);
    });
  });
});

describe('msFromTimeString', () => {
  it.each([
    ['500ms', 500],
    ['15m', 900_000],
    ['7d', 604_800_000],
    ['3600', 3_600_000],
    ['2h', 7_200_000],
    ['30s', 30_000],
  ])('parses %s -> %dms', (input, expected) => {
    expect(msFromTimeString(input)).toBe(expected);
  });

  it('rejects malformed durations', () => {
    expect(() => msFromTimeString('soon')).toThrow(/Invalid duration/);
  });
});
