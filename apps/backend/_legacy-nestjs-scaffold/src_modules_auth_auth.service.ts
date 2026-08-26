import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  TokenService,
  PasswordService,
} from '@wco/auth';
import { PrismaService } from '@wco/database';
import { RedisService } from '../../infrastructure/cache/redis.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

const LOGIN_ATTEMPTS_WINDOW = 15 * 60; // seconds
const LOGIN_ATTEMPTS_MAX = 8;

/**
 * AuthService — credential lifecycle for merchant dashboard users.
 *
 * Security invariants:
 *  - Per-email login attempt throttling (Redis) — brute-force resistant
 *    even though global IP throttling exists at the edge.
 *  - Refresh tokens rotate on every use; reuse nukes the family.
 *  - Passwords hashed with bcrypt (cost 12) via @wco/auth.
 *  - Registration is the ONLY place merchants are created (multi-tenant root).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto, ip?: string) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await this.passwords.hash(dto.password);

    // Merchant + owner user created atomically — tenancy root must exist
    // before anything else can reference it.
    const user = await this.prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          companyName: `${dto.fullName.split(' ')[0]}'s Store`,
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          country: dto.country,
        },
      });
      return tx.user.create({
        data: {
          merchantId: merchant.id,
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          passwordHash,
          role: 'OWNER',
        },
        include: { merchant: true },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorIp: ip,
        action: 'auth.register',
        resource: 'merchant',
        resourceId: user.merchantId,
      },
    });

    const pair = await this.tokens.issuePair(
      { id: user.id, merchantId: user.merchantId, email: user.email, role: user.role },
      ip,
    );
    return this.withUser(pair, user);
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const email = dto.email.toLowerCase();
    const attemptsKey = `login:${email}`;
    const attempts = await this.redis.client.incr(attemptsKey);
    if (attempts === 1) await this.redis.client.expire(attemptsKey, LOGIN_ATTEMPTS_WINDOW);
    if (attempts > LOGIN_ATTEMPTS_MAX) {
      throw new ForbiddenException('Too many login attempts. Try again later.');
    }

    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      include: { merchant: true },
    });

    // Constant-shape failure: same error + bcrypt compare even for unknown
    // users (timing + enumeration defense).
    const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const valid = await this.passwords.compare(dto.password, hash);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');

    await this.redis.client.del(attemptsKey);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { actorUserId: user.id, actorIp: ip, action: 'auth.login', resource: 'user', resourceId: user.id },
    });

    const pair = await this.tokens.issuePair(
      { id: user.id, merchantId: user.merchantId, email: user.email, role: user.role },
      ip ?? userAgent,
    );
    return this.withUser(pair, user);
  }

  /**
   * Rotate refresh token -> new pair. Single-use tokens: replay of a consumed
   * token returns null and forces re-authentication.
   */
  async refresh(refreshToken: string, ip?: string) {
    const rotated = await this.tokens.rotate(refreshToken);
    if (!rotated) throw new UnauthorizedException('Refresh token invalid or already used');

    const user = await this.prisma.user.findFirst({
      where: { id: rotated.userId, isActive: true },
      include: { merchant: true },
    });
    if (!user) throw new UnauthorizedException('Account disabled');

    const pair = await this.tokens.issuePair(
      { id: user.id, merchantId: user.merchantId, email: user.email, role: user.role },
      ip,
    );
    return this.withUser(pair, user);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) await this.tokens.revoke(refreshToken);
  }

  /** Session introspection for the dashboard header. */
  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        lastLoginAt: true,
        merchant: { select: { id: true, companyName: true, plan: true, country: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private withUser(pair: { accessToken: string; refreshToken: string; expiresIn: number }, user: {
    id: string;
    merchantId: string;
    email: string;
    role: string;
    fullName: string;
    merchant: { id: string; companyName: string; plan: string };
  }) {
    return {
      ...pair,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        merchant: user.merchant,
      },
    };
  }
}
