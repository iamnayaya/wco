import { AppError, ForbiddenError, UnauthorizedError, type UserRole } from '@wco/shared';
import type { Request, RequestHandler } from 'express';

/**
 * Role-Based Access Control.
 *
 * Model: 4 roles (OWNER > ADMIN > AGENT > VIEWER) mapped to a permission
 * matrix. Middleware is declarative at the route level; services NEVER trust
 * role checks alone — tenant scoping (`storeId`) is enforced separately in
 * the data layer. Defense in depth, not a single gate.
 */

export interface AuthContext {
  readonly mode: 'user' | 'api';
  readonly userId: string | null;
  readonly merchantId: string;
  /** Active store for the request — set by tenantScope middleware. */
  storeId?: string;
  readonly role: UserRole;
  readonly email?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const ROLE_RANK: Record<UserRole, number> = {
  OWNER: 4,
  SUPER_ADMIN: 5,
  ADMIN: 3,
  AGENT: 2,
  VIEWER: 1,
};

/** Capability catalog - add new permissions here, not inline in routes. */
export const PERMISSIONS = {
  'store:read': ['OWNER', 'ADMIN', 'AGENT', 'VIEWER'],
  'store:write': ['OWNER', 'ADMIN'],
  'user:manage': ['OWNER', 'ADMIN'],
  'billing:manage': ['OWNER'],
  'product:write': ['OWNER', 'ADMIN', 'AGENT'],
  'order:write': ['OWNER', 'ADMIN', 'AGENT'],
  'conversation:handle': ['OWNER', 'ADMIN', 'AGENT'],
  'campaign:write': ['OWNER', 'ADMIN'],
  'analytics:read': ['OWNER', 'ADMIN', 'AGENT', 'VIEWER'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

/** Typed accessor for handlers after `authenticate()` — never asserts `!`. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth;
}

/** Store-scoped accessor for handlers chained after `tenantScope()`. */
export function getStoreId(req: Request): string {
  const auth = getAuth(req);
  if (!auth.storeId) {
    throw new AppError('INTERNAL_ERROR', 'Route is missing tenantScope() middleware');
  }
  return auth.storeId;
}

export function requireAuth(): (req: Request) => AuthContext {
  return (req: Request): AuthContext => {
    if (!req.auth) throw new UnauthorizedError();
    return req.auth;
  };
}

/** Allow-list check — e.g. only OWNER may delete a store. */
export function requireRole(...roles: readonly UserRole[]): RequestHandler {
  return (req, _res, next) => {
    try {
      const auth = requireAuth()(req);
      if (!roles.includes(auth.role)) {
        throw new ForbiddenError(`Role ${auth.role} is not permitted for this action`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Rank check — OWNER passes anything AGENT passes. */
export function requireMinRole(min: UserRole): RequestHandler {
  return (req, _res, next) => {
    try {
      const auth = requireAuth()(req);
      if (ROLE_RANK[auth.role] < ROLE_RANK[min]) {
        throw new ForbiddenError(`Requires ${min} or higher`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Permission check — preferred style; roles stay decoupled from routes. */
export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    try {
      const auth = requireAuth()(req);
      if (auth.role === 'SUPER_ADMIN') {
        next();
        return;
      }
      const allowed = PERMISSIONS[permission] as readonly UserRole[];
      if (!allowed.includes(auth.role)) {
        throw new ForbiddenError(`Missing permission: ${permission}`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
