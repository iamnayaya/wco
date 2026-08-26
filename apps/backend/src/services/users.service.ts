import type { Prisma, User } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '@wco/shared';
import type { UserRole } from '@wco/shared';

import { prisma } from '../lib/prisma.js';

import { authService } from './auth.service.js';

/**
 * Team management — merchant users (OWNER / ADMIN / AGENT / VIEWER).
 * Guards: cannot demote/deactivate the LAST OWNER (tenant lockout).
 */

export interface CreateUserInput {
  readonly email: string;
  readonly fullName: string;
  readonly role: UserRole;
  readonly temporaryPassword: string;
}

export class UsersService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async list(merchantId: string): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await this.db.user.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(({ passwordHash: _hash, ...safe }) => safe);
  }

  async create(merchantId: string, input: CreateUserInput): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.db.user.findFirst({
      where: { merchantId, email: input.email.toLowerCase() },
    });
    if (existing) throw new ConflictError('A user with this email already exists');

    const passwordHash = await authService.hashPassword(input.temporaryPassword);
    const user = await this.db.user.create({
      data: {
        merchantId,
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        role: input.role,
        passwordHash,
        isActive: true,
        status: 'ACTIVE',
        settings: { mustChangePassword: true },
      },
    });
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  async updateRole(merchantId: string, userId: string, role: UserRole): Promise<void> {
    const user = await this.getScoped(this.db, merchantId, userId);
    if (user.role === 'OWNER' && role !== 'OWNER') {
      const owners = await countActiveOwners(this.db, merchantId);
      if (owners <= 1) throw new ConflictError('Cannot demote the last owner');
    }
    await this.db.user.update({ where: { id: userId }, data: { role } });
  }

  async setActive(merchantId: string, userId: string, isActive: boolean): Promise<void> {
    const user = await this.getScoped(this.db, merchantId, userId);
    if (!isActive && user.role === 'OWNER') {
      const owners = await countActiveOwners(this.db, merchantId);
      if (owners <= 1) throw new ForbiddenError('Cannot deactivate the last owner');
    }
    await this.db.user.update({ where: { id: userId }, data: { isActive } });
    if (!isActive) {
      // Kill live sessions immediately.
      await this.db.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  private async getScoped(db: typeof prisma, merchantId: string, userId: string): Promise<User> {
    const user = await db.user.findFirst({ where: { id: userId, merchantId } });
    if (!user) throw new NotFoundError('User');
    return user;
  }
}

async function countActiveOwners(db: typeof prisma, merchantId: string): Promise<number> {
  return db.user.count({ where: { merchantId, role: 'OWNER', isActive: true } });
}

export type UserSafe = Omit<User, 'passwordHash'>;
export type { Prisma };
export const usersService = new UsersService();
