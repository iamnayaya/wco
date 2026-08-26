import { NotFoundError, UnauthorizedError } from '@wco/shared';
import type { NextFunction, Request, Response } from 'express';

import { API_TOKEN_PREFIX } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { tokenService } from '../services/token.service.js';
import { hashToken } from '../utils/crypto.js';

import { getRequestContext } from './request-context.js';

/**
 * Authentication middleware — two credential types on one Bearer header:
 *
 *   1. User JWT (access token) — stateless, 15m TTL, claims trusted in-window.
 *   2. Public API token (`wco_...`) — machine clients; sha256 lookup, revocable.
 *
 * Sets `req.auth`. Routes that need a store context chain `tenantScope()`
 * after this to resolve + authorize X-Store-Id (multi-tenancy guard).
 */
export function authenticate(): (req: Request, _res: Response, next: NextFunction) => void {
  return (req, _res, next): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      next(new UnauthorizedError('Missing bearer credentials'));
      return;
    }
    const raw = header.slice('Bearer '.length).trim();

    void resolveAuth(raw)
      .then((auth) => {
        if (!auth) {
          next(new UnauthorizedError('Invalid or expired credentials'));
          return;
        }
        req.auth = auth;
        next();
      })
      .catch(next);
  };
}

async function resolveAuth(raw: string): Promise<Request['auth'] | null> {
  if (raw.startsWith(API_TOKEN_PREFIX)) return resolveApiToken(raw);
  return resolveUserJwt(raw);
}

async function resolveUserJwt(raw: string): Promise<Request['auth'] | null> {
  try {
    // Server-side revocation: denylisted jti (logout/password change) fails
    // immediately even though the JWT signature is still valid.
    if (await tokenService.isAccessTokenDenied(raw)) return null;
    const payload = tokenService.verifyAccessToken(raw);
    // API tokens are hashed with the same sha256 helper but live in their own
    // table; JWTs are distinguishable by payload shape (`typ` claim).
    return {
      mode: 'user',
      userId: payload.sub,
      merchantId: payload.merchantId,
      role: payload.role,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

async function resolveApiToken(raw: string): Promise<Request['auth'] | null> {
  const record = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!record || record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null;

  touchApiToken(record.id); // fire-and-forget last-used marker
  return { mode: 'api', userId: null, merchantId: record.merchantId, role: 'ADMIN' };
}

const touch = new Map<string, number>(); // in-memory throttle: 1 write / 5 min / token
function touchApiToken(id: string): void {
  const now = Date.now();
  if ((touch.get(id) ?? 0) > now - 5 * 60_000) return;
  touch.set(id, now);
  void prisma.apiToken.update({ where: { id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
}

/**
 * Multi-tenant scope resolver. Resolves the active store from `X-Store-Id`
 * (falls back to the merchant's first active store), verifies it belongs to
 * the authenticated merchant, and publishes tenant info into ALS so audit
 * logging and services can enforce scoping without extra plumbing.
 */
export function tenantScope(): (req: Request, _res: Response, next: NextFunction) => void {
  return (req, _res, next): void => {
    const auth = req.auth;
    if (!auth) {
      next(new UnauthorizedError());
      return;
    }

    const requestedStoreId =
      typeof req.headers['x-store-id'] === 'string' ? req.headers['x-store-id'] : undefined;

    void prisma.store
      .findFirst({
        where: requestedStoreId
          ? { id: requestedStoreId, merchantId: auth.merchantId }
          : { merchantId: auth.merchantId, status: 'ACTIVE' },
        select: { id: true, merchantId: true },
        orderBy: { createdAt: 'asc' },
      })
      .then((store) => {
        if (!store) throw new NotFoundError(requestedStoreId ? 'Store' : 'Active store');
        auth.storeId = store.id;
        const rctx = getRequestContext();
        if (rctx) {
          rctx.tenant = {
            userId: auth.userId ?? `api:${req.ip ?? 'unknown'}`,
            merchantId: auth.merchantId,
            storeId: store.id,
            role: auth.role,
          };
        }
        next();
      })
      .catch(next);
  };
}
