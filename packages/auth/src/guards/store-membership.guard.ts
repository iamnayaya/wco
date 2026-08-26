import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '@wco/shared';
import { PrismaService } from '@wco/database';

const PUBLIC_KEY = 'wco:is-public-route';

/** Mark a route as public (skips JwtAuthGuard). */
export const Public = (): MethodDecorator => SetMetadata(PUBLIC_KEY, true);

export const IS_PUBLIC_KEY = PUBLIC_KEY;

/**
 * StoreMembershipGuard — verifies the X-Store-Id header references a store
 * owned by the caller's merchant. This is the multi-tenant boundary.
 */
export class StoreMembershipGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector?.get<boolean>(PUBLIC_KEY, context.getHandler())) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest & { storeId?: string }>();
    const user = request.user;
    const requestedStoreId = request.headers['x-store-id'];

    if (!user) throw new UnauthorizedError();
    // Routes without a store scope (e.g. /stores list) pass through.
    if (!requestedStoreId || Array.isArray(requestedStoreId)) return true;

    const owns = await this.prisma.store.findFirst({
      where: { id: requestedStoreId, merchantId: user.merchantId },
      select: { id: true },
    });
    if (!owns) throw new ForbiddenError('Store not accessible for this account');

    request.storeId = requestedStoreId;
    return true;
  }
}
