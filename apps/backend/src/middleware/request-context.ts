import { AsyncLocalStorage } from 'node:async_hooks';

import type { UserRole } from '@wco/shared';

/**
 * Request-scoped state via AsyncLocalStorage.
 *
 * Why not just attach fields to `req`? Background continuations spawned by a
 * request (queue enqueues, audit writes after response) lose access to `req`,
 * but ALS keeps the context flowing — this is how audit logs and analytics
 * events stay correlated without threading parameters through every call.
 */

export interface TenantInfo {
  readonly userId: string;
  readonly merchantId: string;
  readonly storeId: string;
  readonly role: UserRole;
}

export interface RequestContext {
  readonly requestId: string;
  readonly startedAt: number;
  tenant?: TenantInfo;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContextStorage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/** Current tenant or null — safe in cron/worker scope. */
export function currentTenant(): TenantInfo | null {
  return requestContextStorage.getStore()?.tenant ?? null;
}

/** Require tenant — services call this to enforce multi-tenant scoping. */
export function requireTenant(): TenantInfo {
  const tenant = currentTenant();
  if (!tenant) {
    throw new Error('Tenant context required but absent — route is missing tenantScope middleware');
  }
  return tenant;
}
