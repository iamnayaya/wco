import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, type UserRole } from '@wco/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { FastifyRequest } from 'fastify';

/**
 * RolesGuard — coarse RBAC. Reads @Roles() metadata; absence of metadata
 * means the route is open to any authenticated role.
 * Hierarchy: OWNER > ADMIN > AGENT > VIEWER.
 */
const RANK: Record<UserRole, number> = { OWNER: 4, ADMIN: 3, AGENT: 2, VIEWER: 1 };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const role = request.user?.role as UserRole | undefined;
    if (!role || !required.some((r) => RANK[r] >= RANK[role])) {
      throw new ForbiddenError(`Requires one of: ${required.join(', ')}`);
    }
    return true;
  }
}
