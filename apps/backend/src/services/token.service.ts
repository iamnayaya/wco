import { randomBytes } from 'node:crypto';

import type { UserRole } from '@wco/shared';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env.js';
import { getRedis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { hashToken } from '../utils/crypto.js';

/**
 * Token lifecycle.
 *
 * - Access tokens: short-lived signed JWTs (stateless, claims trusted within
 *   their 15-minute window — revocation happens at refresh time).
 * - Refresh tokens: opaque 384-bit random strings stored HASHED in Postgres
 *   with rotation on every use (theft of a refresh token is detectable: the
 *   rotated-away token gets replayed -> family revoked).
 * - Password-reset tokens: opaque, hashed, stored in Redis with 15m TTL —
 *   ephemeral credentials don't deserve durable tables.
 */

export interface AccessTokenPayload {
  readonly sub: string;
  readonly merchantId: string;
  readonly role: UserRole;
  readonly email: string;
  readonly typ: 'access';
  /** Unique token id - present on tokens minted after the denylist feature. */
  readonly jti?: string;
}

const ACCESS_OPTS: SignOptions = {
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
};

export interface IssuedTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

export class TokenService {
  signAccessToken(payload: Omit<AccessTokenPayload, 'typ'>): string {
    return jwt.sign({ ...payload, typ: 'access', jti: randomBytes(12).toString('hex') }, env.JWT_SECRET, {
      ...ACCESS_OPTS,
      expiresIn: env.JWT_EXPIRES_IN,
    } as SignOptions);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    if (typeof decoded === 'string' || decoded.typ !== 'access') {
      throw new jwt.JsonWebTokenError('wrong token type');
    }
    return decoded as unknown as AccessTokenPayload;
  }

  /** Opaque refresh token + its storage representation. */
  mintRefreshToken(): { raw: string; tokenHash: string; expiresAt: Date } {
    const raw = randomBytes(48).toString('base64url');
    return {
      raw,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + msFromTimeString(env.JWT_REFRESH_EXPIRES_IN)),
    };
  }

  hashRefreshToken(raw: string): string {
    return hashToken(raw);
  }

  mintPasswordResetToken(): { raw: string; tokenHash: string; expiresAt: Date } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 15 * 60_000) };
  }

  // --- Access-token denylist (server-side revocation for JWTs) ---------------

  /**
   * Blacklist an access token's jti until its natural expiry. Used on logout
   * and password change so a stolen access token dies immediately instead of
   * living out its 15-minute window.
   */
  async denylistAccessToken(token: string): Promise<void> {
    let decoded: AccessTokenPayload & { exp?: number; jti?: string };
    try {
      decoded = this.verifyAccessToken(token) as AccessTokenPayload & { exp?: number; jti?: string };
    } catch {
      return; // already invalid - nothing to revoke
    }
    if (!decoded.jti) return;
    const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 900;
    if (ttl <= 0) return;
    try {
      await getRedis().setex(`auth:jti:${decoded.jti}`, ttl, '1');
    } catch (err) {
      // Redis unreachable — revocation is best-effort; the 15m access-token
      // TTL bounds how long a denounced token stays usable.
      logger.warn('token.denylist-store-failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async isAccessTokenDenied(token: string): Promise<boolean> {
    let decoded: AccessTokenPayload;
    try {
      decoded = this.verifyAccessToken(token);
    } catch {
      return true; // structurally invalid tokens are "denied" by definition
    }
    if (!decoded.jti) return false; // legacy token without jti - cannot check
    try {
      const hit = await getRedis().get(`auth:jti:${decoded.jti}`);
      return hit !== null;
    } catch {
      // Redis unreachable — treat tokens as valid; the short access-token TTL
      // bounds the revocation window.
      return false;
    }
  }
}

/** Supports "15m" | "7d" | "3600" style values. */
export function msFromTimeString(value: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration string: ${value}`);
  const n = Number(match[1]);
  switch (match[2]) {
    case undefined: // bare number = seconds (jsonwebtoken convention)
    case 's':
      return n * 1000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
      return n * 86_400_000;
    default:
      return n;
  }
}

export const tokenService = new TokenService();
