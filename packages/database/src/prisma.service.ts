import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface TenantInfo {
  readonly userId: string;
  readonly storeId: string;
  readonly role: string;
}

/**
 * PrismaService — process-wide Prisma client with tenant-awareness hooks.
 *
 * The owning application registers a context factory (usually backed by
 * AsyncLocalStorage TenantContext). Repositories then call `tenant()` inside
 * request scope to obtain { userId, storeId, role } without threading
 * parameters through every function.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static contextFactory: () => TenantInfo | null = () => null;

  /** Register the app-level tenant context extractor. Call once at bootstrap. */
  static registerTenantContext(factory: () => TenantInfo | null): void {
    this.contextFactory = factory;
  }

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [{ emit: 'stdout', level: 'warn' }, { emit: 'event', level: 'query' }]
          : [{ emit: 'stdout', level: 'error' }],
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Current tenant info or null outside request scope (cron, queue consumers).
   * Background jobs MUST scope queries explicitly by storeId instead.
   */
  tenant(): TenantInfo | null {
    return PrismaService.contextFactory();
  }

  /** Require tenant — throws when called outside request scope. */
  requireTenant(): TenantInfo {
    const tenant = this.tenant();
    if (!tenant) {
      throw new Error('Tenant context required but absent. Pass storeId explicitly in jobs.');
    }
    return tenant;
  }
}
