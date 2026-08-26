import { ForbiddenError, UnauthorizedError, ValidationError } from '@wco/shared';
import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { getStoreId, requireMinRole, requirePermission, requireRole } from '../../src/middleware/rbac.js';
import { validate, idParamSchema } from '../../src/middleware/validate.js';

/**
 * RBAC + validation middleware unit tests - pure request-object fakes, no HTTP.
 */

function fakeReq(auth?: unknown): Request {
  return { auth, headers: {}, query: {}, params: {}, body: {} } as unknown as Request;
}

const OWNER = { mode: 'user' as const, userId: 'u1', merchantId: 'm1', role: 'OWNER' as const };
const AGENT = { mode: 'user' as const, userId: 'u2', merchantId: 'm1', role: 'AGENT' as const };
const VIEWER = { mode: 'user' as const, userId: 'u3', merchantId: 'm1', role: 'VIEWER' as const };

/** Runs a middleware against a fake request; returns the `next` spy. */
function runGuard(mw: RequestHandler, req: Request): jest.Mock {
  const next = jest.fn();
  mw(req, {} as Response, next);
  return next;
}

describe('rbac middleware helpers', () => {
  describe('requirePermission', () => {
    it('calls next() for roles present in the permission matrix', () => {
      expect(runGuard(requirePermission('order:write'), fakeReq(AGENT))).toHaveBeenCalledWith();
      expect(runGuard(requirePermission('product:write'), fakeReq(OWNER))).toHaveBeenCalledWith();
    });

    it('forwards ForbiddenError via next() for roles outside the matrix entry', () => {
      const next = runGuard(requirePermission('order:write'), fakeReq(VIEWER));
      const [err] = next.mock.calls[0] as unknown as [ForbiddenError];
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toMatch(/Missing permission/);
    });

    it('forwards UnauthorizedError for unauthenticated requests (401 precedes RBAC)', () => {
      const [err] = runGuard(requirePermission('store:read'), fakeReq(undefined)).mock
        .calls[0] as unknown as [UnauthorizedError];
      expect(err).toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('requireRole / requireMinRole', () => {
    it('enforces exact allow-lists', () => {
      expect(runGuard(requireRole('OWNER'), fakeReq(OWNER))).toHaveBeenCalledWith();
      const [err] = runGuard(requireRole('OWNER'), fakeReq(adminAuth())).mock
        .calls[0] as unknown as [ForbiddenError];
      expect(err.message).toMatch(/not permitted/);
    });

    it('ranks roles hierarchically (OWNER >= AGENT >= VIEWER)', () => {
      expect(runGuard(requireMinRole('AGENT'), fakeReq(OWNER))).toHaveBeenCalledWith();
      const [err] = runGuard(requireMinRole('AGENT'), fakeReq(VIEWER)).mock
        .calls[0] as unknown as [ForbiddenError];
      expect(err.message).toMatch(/Requires AGENT or higher/);
    });
  });

  describe('getStoreId / getAuth', () => {
    it('throws when tenantScope has not resolved a store yet', () => {
      expect(() => getStoreId(fakeReq({ ...OWNER, storeId: undefined }))).toThrowError(/tenantScope/);
    });

    it('returns the resolved store id after tenantScope ran', () => {
      expect(getStoreId(fakeReq({ ...OWNER, storeId: 'st1' }))).toBe('st1');
    });
  });
});

function adminAuth(): { mode: 'user'; userId: string; merchantId: string; role: 'ADMIN' } {
  return { mode: 'user' as const, userId: 'u4', merchantId: 'm1', role: 'ADMIN' as const };
}

describe('validate middleware', () => {
  const schema = z.object({ limit: z.coerce.number().int().default(10), q: z.string().max(5).optional() });
  let req: Request;
  const next = jest.fn();

  beforeEach(() => {
    req = fakeReq();
    next.mockClear();
  });

  it('replaces raw query with coerced, defaults-applied data', () => {
    req.query = {};
    validate({ query: schema })(req, {} as Response, next);
    expect(req.query).toEqual({ limit: 10 });
    expect(next).toHaveBeenCalledWith(); // called with no error
  });

  it('converts Zod issues into a single ValidationError with field details', () => {
    req.query = { q: 'way-too-long-value' };
    validate({ query: schema })(req, {} as Response, next);
    const err = next.mock.calls[0][0] as ValidationError;
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.details).toHaveProperty('q');
  });

  it('exports the shared id param schema', () => {
    expect(idParamSchema.safeParse({ id: 'abc123' }).success).toBe(true);
    expect(idParamSchema.safeParse({ id: '' }).success).toBe(false);
  });
});
