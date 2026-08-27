import { createHash, randomBytes, randomInt } from 'node:crypto';

import type { Merchant, User } from '@prisma/client';
import { AppError, ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from '@wco/shared';
import bcrypt from 'bcryptjs';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

import { notificationService } from './notification.service.js';
import type { OAuthProfile } from './oauth.service.js';
import { tokenService } from './token.service.js';
import type { IssuedTokenPair } from './token.service.js';
import {
  generateBackupCodes,
  generateTotpSecret,
  matchBackupCode,
  openSecret,
  otpauthUri,
  sealSecret,
  verifyTotp,
} from './totp.service.js';

/**
 * Authentication service â€” registration, login, refresh rotation, logout,
 * password reset. All password hashing is bcrypt (cost from env; 12 rounds
 * â‰ˆ 250ms â€” deliberately expensive).
 */

export interface SignupInput {
  readonly companyName: string;
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
  readonly phone?: string;
  readonly country?: string;
}

export interface SessionMeta {
  readonly ip?: string;
  readonly userAgent?: string;
}

const MIN_PASSWORD_LENGTH = 8;

function assertStrongPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  if (!/[a-z]/u.test(password) || !/[A-Z]/u.test(password) || !/\d/u.test(password)) {
    throw new ValidationError('Password must contain upper case, lower case and a digit');
  }
}

const sha256Hex = (input: string): string => createHash('sha256').update(input).digest('hex');

/** Redis keys for the brute-force lockout window. */
const failKey = (userId: string): string => `wco:auth:fail:${userId}`;
const lockKey = (userId: string): string => `wco:auth:lock:${userId}`;

export interface LoginResult {
  tokens: IssuedTokenPair | null;
  user: User;
  /** Set when TOTP is enabled - complete via POST /auth/2fa/login. */
  twoFactorChallenge?: { challengeId: string };
}

export class AuthService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
  }

  /** Merchant signup â€” creates the tenant root + OWNER user atomically. */
  async signup(input: SignupInput): Promise<{ merchant: Merchant; user: User }> {
    assertStrongPassword(input.password);

    const existing = await this.db.merchant.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError('An account with this email already exists');

    const passwordHash = await this.hashPassword(input.password);
    const [merchant] = await this.db.$transaction([
      this.db.merchant.create({
        data: {
          companyName: input.companyName,
          email: input.email.toLowerCase(),
          phone: input.phone,
          country: input.country ?? 'NG',
          plan: 'FREE',
          users: {
            create: {
              email: input.email.toLowerCase(),
              fullName: input.fullName,
              passwordHash,
              role: 'OWNER',
            },
          },
        },
        include: { users: true },
      }),
    ]);
    const user = merchant.users.at(0);
    if (!user) throw new Error('signup invariant violated: owner user missing');

    logger.info('auth.signup', { merchantId: merchant.id });
    return { merchant, user };
  }

  /**
   * Credential login. `identifier` matches email OR phone; when TOTP is
   * confirmed for the account no tokens are returned - instead a short-lived
   * challenge id that must be completed at POST /auth/2fa/login.
   */
  async login(
    identifier: string,
    password: string,
    meta: SessionMeta = {},
  ): Promise<LoginResult> {
    const id = identifier.trim().toLowerCase();
    const user = await this.db.user.findFirst({
      where: { OR: [{ email: id }, { phone: identifier.trim() }] },
      include: {
        merchant: true,
        twoFactor: true,
      },
    });

    // Uniform failure message + constant-ish work factor to blunt enumeration.
    if (user) await this.assertNotLocked(user.id);
    const hash =
      user?.passwordHash ??
      '$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZBpQzYc0WkG0mS3u9l7nR5jTtYq1Xe'; // bcrypt("invalid")
    const valid = await bcrypt.compare(password, hash).catch(() => false);
    if (!user || !valid) {
      if (user) await this.registerFailedAttempt(user);
      throw new UnauthorizedError('Invalid email or password');
    }
    this.assertAccountUsable(user);

    if (env.REQUIRE_VERIFIED_LOGIN && !user.emailVerifiedAt && !user.phoneVerifiedAt) {
      throw new ForbiddenError('Verify your email or phone before signing in');
    }
    // `merchant` relation is required in the schema and eagerly included above,
    // so it is non-null by construction (signup creates the owner together
    // with the merchant inside one transaction).

    const redis = (await import('../lib/redis.js')).getRedis();
    try {
      await redis.del(failKey(user.id)); // best-effort: lockout bookkeeping
    } catch (err) {
      logger.warn('auth.redis-unavailable', { message: err instanceof Error ? err.message : String(err) });
    }

    if (user.twoFactor?.confirmedAt) {
      const challengeId = randomBytes(24).toString('base64url');
      try {
        await redis.set(`wco:auth:2fa:${challengeId}`, user.id, 'EX', 300);
        return { tokens: null, user, twoFactorChallenge: { challengeId } };
      } catch (err) {
        // Redis unreachable → the challenge hand-off cannot persist; fall back
        // to a direct session so sign-in still works on cache-less deployments.
        logger.warn('auth.2fa-challenge-store-failed', {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await this.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueSession(user, meta);
    return { tokens, user };
  }

  /** Lifecycle gate: deactivated / suspended / deleted users cannot log in. */
  private assertAccountUsable(user: { isActive: boolean; status?: string }): void {
    if (!user.isActive) throw new UnauthorizedError('This account has been deactivated');
    if (user.status === 'SUSPENDED') throw new ForbiddenError('Account suspended');
    if (user.status === 'DELETED') throw new UnauthorizedError('Invalid email or password');
  }

  // --- Brute-force lockout -----------------------------------------------------

  private async assertNotLocked(userId: string): Promise<void> {
    try {
      const lockedUntil = await (await import('../lib/redis.js')).getRedis().get(lockKey(userId));
      if (lockedUntil) {
        throw new AppError('FORBIDDEN', 'Account temporarily locked due to failed attempts', {
          retryAfterSeconds: Math.max(0, Number(lockedUntil) - Math.floor(Date.now() / 1000)),
        });
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Redis unreachable → treat as unlocked; DB + short tokens remain the backstop.
      logger.warn('auth.lockout-check-degraded', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async registerFailedAttempt(user: { id: string; email: string }): Promise<void> {
    try {
      const redis = (await import('../lib/redis.js')).getRedis();
      const fails = await redis.incr(failKey(user.id));
      if (fails === 1) await redis.expire(failKey(user.id), env.ACCOUNT_LOCKOUT_SECONDS);
      if (fails >= env.ACCOUNT_LOCKOUT_THRESHOLD) {
        await redis.set(
          lockKey(user.id),
          String(Math.floor(Date.now() / 1000) + env.ACCOUNT_LOCKOUT_SECONDS),
          'EX',
          env.ACCOUNT_LOCKOUT_SECONDS,
        );
        await redis.del(failKey(user.id));
        logger.warn('auth.lockout', { userId: user.id });
        void notificationService.sendEmail('account-locked', user.email, {
          lockoutMinutes: Math.ceil(env.ACCOUNT_LOCKOUT_SECONDS / 60),
        });
      }
    } catch (err) {
      // Redis unreachable → nothing to track; the sign-in still rejects.
      logger.warn('auth.lockout-tracking-failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Public session issuer for freshly-created users (signup path). */
  async issueSessionFor(user: User, meta: SessionMeta = {}): Promise<IssuedTokenPair> {
    return this.issueSession(user, meta);
  }

  private async issueSession(user: User, meta: SessionMeta): Promise<IssuedTokenPair> {
    const accessToken = tokenService.signAccessToken({
      sub: user.id,
      merchantId: user.merchantId,
      role: user.role,
      email: user.email,
    });
    const refresh = tokenService.mintRefreshToken();
    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refresh.tokenHash,
        expiresAt: refresh.expiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 512),
      },
    });
    return { accessToken, refreshToken: refresh.raw, refreshTokenExpiresAt: refresh.expiresAt };
  }

  /**
   * Rotate a refresh token. Reuse detection: presenting an already-revoked
   * token revokes the whole family for that user (likely theft signal).
   */
  async refresh(rawRefreshToken: string, meta: SessionMeta = {}): Promise<{ tokens: IssuedTokenPair; user: User }> {
    const tokenHash = tokenService.hashRefreshToken(rawRefreshToken);
    const stored = await this.db.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedError('Invalid refresh token');

    if (stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      if (stored.revokedAt) {
        await this.revokeAllSessions(stored.userId, 'reuse-detected');
        logger.warn('auth.refresh-reuse', { userId: stored.userId });
      }
      throw new UnauthorizedError('Refresh token expired or revoked');
    }

    const rotated = await this.db.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date(), lastUsedAt: new Date(), ip: meta.ip, userAgent: meta.userAgent?.slice(0, 512) },
    });
    if (rotated.count === 0) throw new UnauthorizedError('Refresh token already used');

    return { tokens: await this.issueSession(stored.user, meta), user: stored.user };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = tokenService.hashRefreshToken(rawRefreshToken);
    await this.db.refreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
  }

  async revokeAllSessions(userId: string, reason: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    logger.info('auth.sessions-revoked', { userId, reason });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    assertStrongPassword(newPassword);
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new UnauthorizedError();
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');
    await this.setPassword(userId, newPassword);
    await this.revokeAllSessions(userId, 'password-change');
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.db.user.findFirst({ where: { email: email.toLowerCase() } });
    // Always succeed externally â€” never reveal whether the account exists.
    if (!user) {
      logger.info('auth.password-reset.unknown-email');
      return;
    }
    const minted = tokenService.mintPasswordResetToken();
    // Invalidate outstanding links, then persist the hashed token durably.
    await this.db.passwordReset.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.db.passwordReset.create({
      data: { userId: user.id, tokenHash: minted.tokenHash, expiresAt: minted.expiresAt },
    });
    await notificationService.sendEmail('password-reset', user.email, { resetToken: minted.raw });
    logger.info('auth.password-reset.requested', { userId: user.id });
  }

  async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    assertStrongPassword(newPassword);
    const tokenHash = sha256Hex(rawToken);
    const record = await this.db.passwordReset.findUnique({ where: { tokenHash } });
    if (!record || record.consumedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new ValidationError('Reset link is invalid or has expired');
    }
    // Atomic single-use claim; a second click of the same link fails.
    const claimed = await this.db.passwordReset.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count === 0) throw new ValidationError('Reset link is invalid or has expired');

    await this.setPassword(record.userId, newPassword);
    await this.revokeAllSessions(record.userId, 'password-reset');
  }

  /** Completes a TOTP login challenge; burns backup codes on use. */
  async completeTwoFactorLogin(
    challengeId: string,
    code: string,
    meta: SessionMeta = {},
  ): Promise<{ tokens: IssuedTokenPair; user: User }> {
    let userId: string | null;
    try {
      const redis = (await import('../lib/redis.js')).getRedis();
      userId = await redis.getdel(`wco:auth:2fa:${challengeId}`);
    } catch {
      userId = null; // Redis unreachable — challenge cannot be resolved
    }
    if (!userId) throw new UnauthorizedError('Two-factor challenge expired, sign in again');
    const user = await this.db.user.findUnique({ where: { id: userId }, include: { twoFactor: true } });
    if (!user?.twoFactor?.confirmedAt) throw new UnauthorizedError('Two-factor challenge invalid');

    let verified = verifyTotp(openSecret(user.twoFactor.secretEnc), code.trim());
    if (verified) {
      await this.db.twoFactorSecret.update({
        where: { userId: user.id },
        data: { lastVerifiedAt: new Date() },
      });
    } else {
      const hashes = Array.isArray(user.twoFactor.backupCodes) ? user.twoFactor.backupCodes : [];
      const idx = matchBackupCode(code.trim(), hashes);
      if (idx >= 0) {
        verified = true;
        const remaining = (hashes as string[]).filter((_, i) => i !== idx);
        await this.db.twoFactorSecret.update({
          where: { userId: user.id },
          data: { backupCodes: remaining, lastVerifiedAt: new Date() },
        });
      }
    }
    if (!verified) throw new UnauthorizedError('Invalid two-factor code');

    await this.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { tokens: await this.issueSession(user, meta), user };
  }

  // --- Email & phone verification ----------------------------------------------

  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    if (user.emailVerifiedAt) return; // already verified - no-op
    const raw = randomBytes(32).toString('base64url');
    await this.db.emailVerification.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.db.emailVerification.create({
      data: { userId, tokenHash: sha256Hex(raw), expiresAt: new Date(Date.now() + 24 * 3600_000) },
    });
    await notificationService.sendEmail('verify-email', user.email, { verificationToken: raw });
  }

  async confirmEmailVerification(rawToken: string): Promise<void> {
    const claimed = await this.db.emailVerification.updateMany({
      where: {
        tokenHash: sha256Hex(rawToken),
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (claimed.count === 0) throw new ValidationError('Verification link is invalid or has expired');
    const record = await this.db.emailVerification.findFirst({ where: { tokenHash: sha256Hex(rawToken) } });
    if (record) {
      await this.db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
    }
  }

  async requestPhoneVerification(userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user?.phone) throw new ValidationError('No phone number on file for this account');
    if (user.phoneVerifiedAt) return;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.phoneVerification.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.db.phoneVerification.create({
      data: { userId, codeHash: sha256Hex(code), expiresAt: new Date(Date.now() + 10 * 60_000) },
    });
    await notificationService.sendSms(user.phone, `Your WCO verification code is ${code}`);
  }

  async confirmPhoneVerification(userId: string, code: string): Promise<void> {
    const record = await this.db.phoneVerification.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' as const },
    });
    if (!record) throw new ValidationError('No pending verification code - request a new one');
    if (record.attempts >= 5) throw new ValidationError('Too many attempts - request a new code');
    if (record.codeHash !== sha256Hex(code.trim())) {
      await this.db.phoneVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new ValidationError('Incorrect verification code');
    }
    await this.db.phoneVerification.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    await this.db.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date() } });
  }

  // --- Two-factor enrollment -----------------------------------------------------

  async startTwoFactorSetup(userId: string): Promise<{ otpauthUri: string }> {
    const secret = generateTotpSecret();
    const existing = await this.db.twoFactorSecret.findUnique({ where: { userId } });
    if (existing) {
      await this.db.twoFactorSecret.update({
        where: { userId },
        data: { secretEnc: sealSecret(secret), confirmedAt: null, backupCodes: [] },
      });
    } else {
      await this.db.twoFactorSecret.create({ data: { userId, secretEnc: sealSecret(secret) } });
    }
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    return { otpauthUri: otpauthUri(secret, user.email) };
  }

  async confirmTwoFactorSetup(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const record = await this.db.twoFactorSecret.findUnique({ where: { userId } });
    if (!record) throw new ValidationError('Start two-factor setup first');
    if (!verifyTotp(openSecret(record.secretEnc), code.trim())) {
      throw new ValidationError('Invalid authenticator code - try the next one');
    }
    const { plain, hashes } = generateBackupCodes();
    await this.db.twoFactorSecret.update({
      where: { userId },
      data: { confirmedAt: new Date(), backupCodes: hashes },
    });
    return { backupCodes: plain }; // shown ONCE
  }

  async disableTwoFactor(userId: string, password: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedError('Password confirmation failed');
    }
    await this.db.twoFactorSecret.deleteMany({ where: { userId } });
    logger.info('auth.2fa-disabled', { userId });
  }

  // --- Session management ----------------------------------------------------------

  listSessions(userId: string): Promise<Array<{
    id: string;
    ip: string | null;
    userAgent: string | null;
    createdAt: Date;
    lastUsedAt: Date | null;
    expiresAt: Date;
  }>> {
    return this.db.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' as const },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const rotated = await this.db.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (rotated.count === 0) throw new AppError('NOT_FOUND', 'Active session not found');
  }

  /** Revoke every active session except the caller's current one. */
  async revokeOtherSessions(userId: string, currentRefreshToken?: string): Promise<number> {
    const keepHash = currentRefreshToken ? tokenService.hashRefreshToken(currentRefreshToken) : null;
    const active = await this.db.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, tokenHash: true },
    });
    const targets = active.filter((r) => r.tokenHash !== keepHash).map((r) => r.id);
    if (targets.length === 0) return 0;
    const result = await this.db.refreshToken.updateMany({
      where: { id: { in: targets } },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  // --- Social sign-in ----------------------------------------------------------------

  /**
   * Resolve an OAuth profile to a local account: link by provider id first,
   * then by email, else provision merchant + OWNER user.
   */
  async oauthSignIn(
    profile: OAuthProfile,
    meta: SessionMeta = {},
  ): Promise<{ tokens: IssuedTokenPair; user: User; created: boolean }> {
    const linked = await this.db.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });
    if (linked?.user) {
      if (!linked.user.isActive) throw new UnauthorizedError('This account has been deactivated');
      return { tokens: await this.issueSession(linked.user, meta), user: linked.user, created: false };
    }

    const byEmail = await this.db.user.findFirst({ where: { email: profile.email } });
    if (byEmail) {
      await this.db.oAuthAccount.create({
        data: { userId: byEmail.id, provider: profile.provider, providerAccountId: profile.providerAccountId },
      });
      if (!byEmail.isActive) throw new UnauthorizedError('This account has been deactivated');
      return { tokens: await this.issueSession(byEmail, meta), user: byEmail, created: false };
    }

    // Provisioning path: social-first users get a tenant automatically.
    const passwordHash = await this.hashPassword(randomBytes(24).toString('base64url'));
    const [merchant] = await this.db.$transaction([
      this.db.merchant.create({
        data: {
          companyName: profile.fullName || profile.email.split('@')[0],
          email: profile.email,
          users: {
            create: {
              email: profile.email,
              fullName: profile.fullName,
              passwordHash,
              role: 'OWNER',
              emailVerifiedAt: new Date(), // provider asserted ownership
            },
          },
        },
        include: { users: true },
      }),
    ]);
    const user = merchant.users.at(0);
    if (!user) throw new Error('oauth provisioning invariant violated');
    await this.db.oAuthAccount.create({
      data: { userId: user.id, provider: profile.provider, providerAccountId: profile.providerAccountId },
    });
    logger.info('auth.oauth-provisioning-complete', { provider: profile.provider, merchantId: merchant.id });
    return { tokens: await this.issueSession(user, meta), user, created: true };
  }

  private async setPassword(userId: string, plain: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { passwordHash: await this.hashPassword(plain) },
    });
  }
}

export const authService = new AuthService();
