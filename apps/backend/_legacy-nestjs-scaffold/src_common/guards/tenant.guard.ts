import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@wco/database';
import { TenantContext } from '../context/tenant-context';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator: @RequirePermissions('orders:read', 'orders:write')
 * All permissions listed are required (AND semantics).
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * TenantGuard — the heart of WCO's multi-tenant authorization.
 *
 * Enforces THREE invariants on every request:
 *   1. JWT is valid and contains tenant claims (storeId)
 *   2. Actor holds all required permissions for this route
 *   3. Requested resources belong to the actor's tenant
 *      (deep-check for :id params when a resource map is provided)
 *
 * Combined with Prisma middleware auto-scoping and Postgres RLS,
 * this makes IDOR structurally impossible.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // populated by JwtStrategy

    // Invariant 1: authenticated principal with tenant scope
    if (!user?.userId || !user?.storeId) {
      throw new ForbiddenException('Missing tenant context');
    }

    // Invariant 2: permission check from metadata
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const hasAll = requiredPermissions.every((permission) =>
      this.hasPermission(user.permissions, permission),
    );
    if (!hasAll) {
      throw new ForbiddenException(
        `Requires permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    // Invariant 3: resource ownership deep check
    await this.verifyResourceOwnership(request, user.storeId);

    // Establish tenant context for downstream layers
    // (AsyncLocalStorage → picked up by Prisma middleware + RLS session vars)
    await TenantContext.run(
      { userId: user.userId, storeId: user.storeId, role: user.role },
      async () => {
        await this.prisma.$executeRawUnsafe(
          `SELECT set_config('app.user_id', $1, true), set_config('app.store_id', $2, true)`,
          user.userId,
          user.storeId,
        );
      },
    );

    return true;
  }

  private hasPermission(userPermissions: string[], required: string): boolean {
    if (userPermissions.includes('*:*')) return true;
    if (userPermissions.includes(required)) return true;
    // Wildcard resource match: 'orders' matches 'orders:read'
    const [resource] = required.split(':');
    return userPermissions.includes(`${resource}:*`);
  }

  /**
   * Resource ownership map — routes register which params map to which tables:
   * @OwnershipMap({ orderId: 'order', customerId: 'customer' })
   * Guard then verifies each id belongs to the caller's store before proceeding.
   */
  private async verifyResourceOwnership(
    request: { params: Record<string, string>; ownershipMap?: Record<string, string> | undefined },
    storeId: string,
  ): Promise<void> {
    const map = request.ownershipMap;
    if (!map) return;

    const checks = Object.entries(map).map(async ([param, table]) => {
      const resourceId = request.params[param];
      if (!resourceId) return;

      const record = await (this.prisma as any)[table].findUnique({
        where: { id: resourceId },
        select: { storeId: true },
      });

      if (!record || record.storeId !== storeId) {
        // Deliberately identical to not-found: no existence oracle for attackers
        throw new ForbiddenException('Resource not found');
      }
    });

    await Promise.all(checks);
  }
}