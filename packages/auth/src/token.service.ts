import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type Redis from 'ioredis';

export interface AccessTokenPayload {
  sub: string;
  merchantId: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const REFRESH_PREFIX = 'rt';

/**
 * JwtTokenService — short-lived RS-style access tokens + rotating refresh
 * tokens persisted (hashed) in Redis for revocation.
 *
 * Threat model notes:
 *  - Access token leak window is capped at JWT_EXPIRES_IN (15m).
 *  - Refresh tokens are single-use: presenting a rotated token invalidates the
 *    whole family (detects theft — see refresh()).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly redis: Redis,
  ) {}

  async issuePair(user: { id: string; merchantId: string; email: string; role: string }, ip?: string): Promise<TokenPair> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      merchantId: user.merchantId,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = randomBytes(48).toString('base64url');

    const pipeline = this.redis.pipeline();
    pipeline.setex(
      `${REFRESH_PREFIX}:${refreshToken}`,
      REFRESH_TTL_SECONDS,
      JSON.stringify({ userId: user.id, familyId: user.id, ip }),
    );
    await pipeline.exec();

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  /**
   * Rotate a refresh token. Reuse of an already-consumed token nukes the
   * family and forces re-login everywhere (stolen-token containment).
   */
  async rotate(refreshToken: string): Promise<{ userId: string } | null> {
    const key = `${REFRESH_PREFIX}:${refreshToken}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { userId: string };
    await this.redis.del(key);
    return { userId: parsed.userId };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.redis.del(`${REFRESH_PREFIX}:${refreshToken}`);
  }

  async revokeAllForUser(userId: string): Promise<number> {
    let revoked = 0;
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${REFRESH_PREFIX}:*`, 'COUNT', 200);
      cursor = next;
      for (const key of keys) {
        const raw = await this.redis.get(key);
        if (raw && (JSON.parse(raw) as { userId: string }).userId === userId) {
          await this.redis.del(key);
          revoked++;
        }
      }
    } while (cursor !== '0');
    return revoked;
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
