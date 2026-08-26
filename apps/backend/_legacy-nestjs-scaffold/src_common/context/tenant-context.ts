import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextData {
  readonly userId: string;
  readonly storeId: string;
  readonly role: string;
}

/**
 * TenantContext — request-scoped tenant isolation via AsyncLocalStorage.
 *
 * Propagates { userId, storeId } through the entire async call chain:
 *   Guard → Service → Repository → Prisma middleware → RLS session vars
 *
 * This is THE mechanism that makes multi-tenancy safe without
 * threading context parameters through every function signature.
 */
export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<TenantContextData>();

  /** Run callback within a tenant scope. Called by TenantGuard. */
  static run<T>(context: TenantContextData, callback: () => Promise<T>): Promise<T> {
    return this.storage.run(context, callback);
  }

  /** Current tenant or null when outside request scope (cron, queue consumers). */
  static current(): TenantContextData | null {
    return this.storage.getStore() ?? null;
  }

  /** Require tenant — throws when called outside request scope. */
  static require(): TenantContextData {
    const context = this.current();
    if (!context) {
      throw new Error(
        'TenantContext required but not present. ' +
          'Background jobs must explicitly pass storeId.',
      );
    }
    return context;
  }
}