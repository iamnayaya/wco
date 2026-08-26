import { ForbiddenError } from '@wco/shared';
import type { RequestHandler } from 'express';

import { prisma } from '../lib/prisma.js';

import { requireAuth, type AuthContext } from './rbac.js';

/**
 * Platform-staff gate for /admin/* user-management routes.
 *
 * Why not plain role checks: `ADMIN` is also a merchant-team role. Platform
 * authority = role SUPER_ADMIN, OR role ADMIN with an existing adminProfile
 * row (staff roster). One extra indexed lookup per request is the price of
 * not letting a merchant team-admin into platform ops.
 */
export function requirePlatformAdmin(): RequestHandler {
  return (req, _res, next) => {
    void (async () => {
      try {
        const auth: AuthContext = requireAuth()(req);
        if (auth.role === 'SUPER_ADMIN') {
          next();
          return;
        }
        if (auth.role !== 'ADMIN') {
          throw new ForbiddenError('Platform admin access required');
        }
        const profile = await prisma.adminProfile.findUnique({ where: { userId: auth.userId ?? '' } });
        if (!profile) {
          throw new ForbiddenError('Platform admin access required');
        }
        next();
      } catch (err) {
        next(err);
      }
    })();
  };
}
