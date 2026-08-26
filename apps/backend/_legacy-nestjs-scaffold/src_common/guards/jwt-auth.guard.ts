import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';

export interface AuthenticatedUser {
  sub: string; // userId
  merchantId: string;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * JwtAuthGuard — verifies the Bearer access token and attaches the decoded
 * payload to request.user. Tenant scoping (store selection) happens next in
 * TenantGuard, keeping authentication and authorization orthogonal.
 *
 * API-key auth (machine clients) is handled by ApiKeyGuard on public-API
 * routes; this guard is for dashboard/mobile sessions only.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const token = header.slice('Bearer '.length);
      request.user = await this.jwt.verifyAsync<AuthenticatedUser>(token, {
        secret: process.env.JWT_SECRET,
      });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
