import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AdminGuard — static bearer token for internal ops endpoints.
 * The token lives only in the cluster + admin dashboard env; it is rotated
 * with the rest of platform secrets and never exposed to merchant clients.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['x-admin-token'];
    const expected = this.config.get<string>('ADMIN_API_TOKEN');
    if (!expected) throw new UnauthorizedException('Admin API disabled (no token configured)');

    // Constant-time-ish compare; length check first to avoid timing oracle on prefix
    if (
      typeof header !== 'string' ||
      header.length !== expected.length ||
      !timingSafeEqual(header, expected)
    ) {
      throw new UnauthorizedException('Invalid admin token');
    }
    return true;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
