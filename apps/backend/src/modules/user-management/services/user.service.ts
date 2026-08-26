import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';
import type { Merchant, User } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';
import { notificationService } from '../../../services/notification.service.js';
import type { AdminListQuery } from '../user-management.dto.js';

export interface UserStats {
  userId: string;
  merchantId: string;
  lastLoginAt: Date | null;
  memberSince: Date;
  counts: { orders: number; products: number; customers: number; conversations: number };
  revenueTotal: Prisma.Decimal | number;
}

type FullUser = Prisma.UserGetPayload<{ include: { sellerProfile: true; adminProfile: true; merchant: true } }>;
type ListedUser = Prisma.UserGetPayload<{ include: { sellerProfile: true; adminProfile: true } }>;

/**
 * Platform user lifecycle service (admin + self-service backing).
 *
 * Suspension model: `status=SUSPENDED` + revoked refresh tokens. Live access
 * JWTs die naturally within their 15-minute TTL - acceptable for a marketplace
 * admin action and avoids a Redis denylist write per suspension.
 */

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Pure filter builder - unit-tested without a database. */
export function buildUserWhere(query: Partial<AdminListQuery>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.role) where.role = query.role;
  if (query.email) where.email = query.email;
  if (query.phone) where.phone = query.phone;
  if (query.q) {
    const q = query.q;
    where.OR = [
      { email: { contains: q } },
      { fullName: { contains: q } },
      { phone: { contains: q } },
    ];
  }
  return where;
}

export interface CreateSellerInput {
  companyName: string;
  fullName: string;
  email: string;
  passwordHash: string;
  phone?: string;
  country?: string;
}

export class UserService {
  async createUser(input: CreateSellerInput): Promise<{ merchant: Merchant; user: User }> {
    const existing = await prisma.merchant.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError('An account with this email already exists');

    const [merchant] = await prisma.$transaction([
      prisma.merchant.create({
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
              phone: input.phone,
              passwordHash: input.passwordHash,
              role: 'OWNER',
              isActive: true,
              status: 'ACTIVE',
            },
          },
        },
        include: { users: true },
      }),
    ]);
    const user = merchant.users.at(0);
    if (!user) throw new Error('createUser invariant violated: owner user missing');

    void notificationService.sendEmail('welcome', user.email, { fullName: user.fullName });
    if (user.phone) void notificationService.sendSms(user.phone, 'Welcome to WCO! Your account is ready.');

    logger.info('usermgmt.create', { merchantId: merchant.id });
    return { merchant, user };
  }

  /** Platform-staff account inside an existing merchant tenant. */
  async createStaffUser(input: {
    merchantId: string;
    fullName: string;
    email: string;
    passwordHash: string;
    phone?: string;
  }): Promise<{ user: User }> {
    const merchants = await prisma.merchant.findMany({ where: { id: input.merchantId }, take: 1 });
    if (!merchants.at(0)) throw new NotFoundError('Merchant not found');
    const clash = await prisma.user.findFirst({ where: { email: input.email } });
    if (clash) throw new ConflictError('A user with this email already exists');
    const user = await prisma.user.create({
      data: {
        merchantId: input.merchantId,
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        phone: input.phone,
        passwordHash: input.passwordHash,
        role: 'ADMIN',
        isActive: true,
        status: 'ACTIVE',
      },
    });
    void notificationService.sendEmail('staff-welcome', user.email, { fullName: user.fullName });
    return { user };
  }

  async getUserById(id: string): Promise<FullUser> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { sellerProfile: true, adminProfile: true, merchant: true },
    });
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found');
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const users = await prisma.user.findMany({ where: { email }, take: 1 });
    return users[0] ?? null;
  }

  async getUserByPhone(phone: string): Promise<User | null> {
    const users = await prisma.user.findMany({ where: { phone }, take: 1 });
    return users[0] ?? null;
  }

  async updateUser(id: string, data: { fullName?: string; phone?: string | null; status?: 'ACTIVE' | 'SUSPENDED' }): Promise<User> {
    await this.getUserById(id);
    return prisma.user.update({ where: { id }, data });
  }

  /** Soft delete: anonymize PII, kill sessions, keep audit history intact. */
  async deleteUser(id: string): Promise<void> {
    await this.getUserById(id);
    const suffix = sha256Hex(`deleted:${id}`).slice(0, 8);
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          status: 'DELETED',
          isActive: false,
          fullName: 'Deleted User',
          email: `deleted+${suffix}@wco.invalid`,
          phone: null,
          passwordHash: null,
        },
      }),
      prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  async suspendUser(id: string, reason: string): Promise<User> {
    const user = await this.getUserById(id);
    if (user.status === 'SUSPENDED') throw new ConflictError('User is already suspended');
    const updated = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { status: 'SUSPENDED', isActive: false, suspendedAt: new Date(), suspensionReason: reason },
      }),
      prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    void notificationService.sendEmail('account-suspended', user.email, { reason });
    if (user.phone) void notificationService.sendSms(user.phone, 'Your WCO account has been suspended.');
    return updated[0];
  }

  async unsuspendUser(id: string): Promise<User> {
    const user = await this.getUserById(id);
    if (user.status !== 'SUSPENDED') throw new ConflictError('User is not suspended');
    const updated = await prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true, suspendedAt: null, suspensionReason: null },
    });
    void notificationService.sendEmail('account-restored', user.email, {});
    return updated;
  }

  async listUsers(query: AdminListQuery): Promise<{ items: ListedUser[]; total: number }> {
    const where = buildUserWhere(query);
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ [query.sortBy]: query.sortOrder }],
        skip,
        take: query.pageSize,
        include: { sellerProfile: true, adminProfile: true },
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async countUsers(where: Record<string, unknown> = {}): Promise<number> {
    return prisma.user.count({ where });
  }

  /** Merchant-scoped commerce stats for the admin console detail page. */
  async getUserStats(id: string): Promise<UserStats> {
    const user = await this.getUserById(id);
    const storeRows = await prisma.store.findMany({ where: { merchantId: user.merchantId }, select: { id: true } });
    const storeIds = storeRows.map((s) => s.id);
    const inStores = { storeId: { in: storeIds } };
    const [orders, products, customers, conversations] = await Promise.all([
      prisma.order.count({ where: inStores }),
      prisma.product.count({ where: inStores }),
      prisma.customer.count({ where: inStores }),
      prisma.conversation.count({ where: inStores }),
    ]);
    const revenueAgg = await prisma.order.aggregate({
      where: { ...inStores, status: 'PAID' },
      _sum: { total: true },
    });
    return {
      userId: user.id,
      merchantId: user.merchantId,
      lastLoginAt: user.lastLoginAt,
      memberSince: user.createdAt,
      counts: { orders, products, customers, conversations },
      revenueTotal: revenueAgg._sum.total ?? 0,
    };
  }

  /** Self-service profile update with phone-uniqueness guard. */
  async updateMe(userId: string, actorMerchantId: string, data: { fullName?: string; phone?: string; settings?: Record<string, unknown> }): Promise<User> {
    if (data.phone) {
      const clash = await prisma.user.findFirst({ where: { phone: data.phone, merchantId: { not: actorMerchantId } } });
      if (clash) throw new ConflictError('Phone already in use');
    }
    const update: Record<string, unknown> = {};
    if (data.fullName !== undefined) update.fullName = data.fullName;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.settings !== undefined) update.settings = data.settings as Prisma.InputJsonValue;
    return prisma.user.update({ where: { id: userId }, data: update });
  }

  assertStrongPassword(password: string): void {
    if (
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    ) {
      throw new ValidationError('Password must include upper case, lower case and a digit');
    }
  }
}

export const userService = new UserService();
