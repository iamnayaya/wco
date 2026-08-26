import type { Prisma } from '@prisma/client';

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { currentTenant } from '../middleware/request-context.js';

/**
 * Audit service — append-only compliance trail (NDPR/GDPR friendly).
 *
 * Fire-and-forget by design: audit writes must never fail business flows.
 * Failures are logged at error level and surfaced via the log aggregator
 * alert rule `audit.write-failures > 0` — silence would be a compliance bug.
 */
export interface AuditInput {
  readonly action: string; // e.g. 'product.update'
  readonly resource: string; // e.g. 'Product'
  readonly resourceId?: string;
  readonly storeId?: string;
  readonly before?: Record<string, unknown> | null;
  readonly after?: Record<string, unknown> | null;
}

export class AuditService {
  constructor(private readonly db = prisma) {}

  async record(input: AuditInput): Promise<void> {
    const ctx = currentTenant();
    try {
      await this.db.auditLog.create({
        data: {
          storeId: input.storeId ?? ctx?.storeId ?? null,
          actorUserId: ctx?.userId ?? null,
          actorIp: null, // set explicitly by auth-sensitive call sites when known
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          before: sanitize(input.before) as Prisma.InputJsonValue | undefined,
          after: sanitize(input.after) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      logger.error('audit.write-failure', {
        action: input.action,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/** Strip obvious secrets before they reach the audit trail. */
const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'tokenHash', 'secret']);
function sanitize(record?: Record<string, unknown> | null): Record<string, unknown> | undefined {
  if (!record) return undefined;
  return Object.fromEntries(Object.entries(record).filter(([k]) => !SENSITIVE_KEYS.has(k)));
}

export const auditService = new AuditService();
