import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedError } from '@wco/shared';
import type { FastifyRequest } from 'fastify';

export interface RequestUser {
  id: string;
  merchantId: string;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: RequestUser;
  }
}

/**
 * JwtAuthGuard — bearer-token authentication for the merchant API.
 * Verifies signature + standard claims; tenant context is established
 * downstream by TenantGuard using the merchantId claim.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }

    try {
      const payload = await this.jwt.verifyAsync<RequestUser>(header.slice('Bearer '.length));
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}
