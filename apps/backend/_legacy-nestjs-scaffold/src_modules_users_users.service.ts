import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { TenantContext } from '../../common/context/tenant-context';

/**
 * UsersService — team management within a merchant account.
 * Owners/Admins manage; role changes are audit-logged.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const { merchantId } = TenantContext.require();
    return this.prisma.user.findMany({
      where: { merchantId },
      select: {
        id: true, email: true, fullName: true, role: true,
        isActive: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateRole(actorUserId: string, targetUserId: string, newRole: string) {
    const { merchantId, role } = TenantContext.require();
    if (role !== 'OWNER') throw new NotFoundException('Only owners can change roles');
    if (targetUserId === actorUserId) throw new NotFoundException('You cannot change your own role');

    // Conditional update scoped by merchantId — cross-tenant writes impossible.
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: targetUserId, merchantId },
        data: { role: newRole as never },
      });
      if (result.count === 0) throw new NotFoundException('User not found');

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'user.role_change',
          resource: 'user',
          resourceId: targetUserId,
          after: { role: newRole },
        },
      });
      return tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true, role: true, isActive: true },
      });
    });
  }

  async deactivate(actorUserId: string, targetUserId: string) {
    const { merchantId } = TenantContext.require();
    const result = await this.prisma.user.updateMany({
      where: { id: targetUserId, merchantId, isActive: true },
      data: { isActive: false },
    });
    if (result.count === 0) throw new NotFoundException('User not found or already inactive');

    await this.prisma.auditLog.create({
      data: { actorUserId, action: 'user.deactivate', resource: 'user', resourceId: targetUserId },
    });
    return { ok: true };
  }
}
