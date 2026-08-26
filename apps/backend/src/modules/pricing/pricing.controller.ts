import { NotFoundError, ValidationError } from '@wco/shared';
import type { Request, Response } from 'express';

import { prisma } from '../../lib/prisma.js';
import { getStoreId } from '../../middleware/rbac.js';
import { auditService } from '../../services/audit.service.js';
import { cacheService } from '../../services/cache.service.js';
import { sendSuccess } from '../../utils/api-response.js';

/**
 * Pricing controller - merchant review of AI price suggestions.
 *
 * The ai-engine PRODUCES PriceSuggestion rows; this module is the human
 * approval surface. Apply runs transactionally: suggestion -> APPROVED and
 * product price change commit or roll back together, then the catalog cache
 * flushes so storefront prices update immediately.
 */
export const pricingController = {
  async listSuggestions(req: Request, res: Response): Promise<void> {
    const { status, limit } = req.query as unknown as { status: string; limit: number };
    const suggestions = await prisma.priceSuggestion.findMany({
      where: { storeId: getStoreId(req), status },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    sendSuccess(res, suggestions);
  },

  async apply(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const suggestion = await prisma.priceSuggestion.findFirst({
      where: { id: req.params.id, storeId },
    });
    if (!suggestion) throw new NotFoundError('Price suggestion');
    if (suggestion.status !== 'PENDING') {
      throw new ValidationError(`Suggestion is already ${suggestion.status.toLowerCase()}`);
    }
    if (suggestion.expiresAt && suggestion.expiresAt.getTime() < Date.now()) {
      await prisma.priceSuggestion.update({ where: { id: suggestion.id }, data: { status: 'EXPIRED' } });
      throw new ValidationError('Suggestion has expired');
    }

    const [product] = await prisma.$transaction([
      prisma.product.update({
        where: { id: suggestion.productId },
        data: { price: suggestion.suggestedPrice },
        select: { id: true, name: true, sku: true, price: true },
      }),
      prisma.priceSuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'APPROVED', appliedAt: new Date() },
      }),
    ]);

    void auditService.record({
      action: 'pricing.suggestion-applied',
      resource: 'Product',
      resourceId: suggestion.productId,
      before: { price: Number(suggestion.currentPrice) },
      after: { price: Number(suggestion.suggestedPrice), suggestionId: suggestion.id },
    });
    void cacheService.invalidatePattern(`catalog:${storeId}:*`);
    sendSuccess(res, product);
  },

  async dismiss(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const suggestion = await prisma.priceSuggestion.findFirst({
      where: { id: req.params.id, storeId },
    });
    if (!suggestion) throw new NotFoundError('Price suggestion');

    await prisma.priceSuggestion.update({ where: { id: suggestion.id }, data: { status: 'DISMISSED' } });
    sendSuccess(res, { dismissed: true });
  },
} as const;
