import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@wco/database';
import { RabbitMQService } from '../../infrastructure/queue/rabbitmq.service';
import { TenantContext } from '../../common/context/tenant-context';

/**
 * PricingService — AI pricing optimizer control plane.
 *
 * The AI engine computes suggestions asynchronously; this service handles
 * the human decision loop. Approval applies the new price atomically and
 * writes a full audit trail — price history is money history.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  async listSuggestions(status = 'PENDING') {
    const { storeId } = TenantContext.require();
    return this.prisma.priceSuggestion.findMany({
      where: { storeId, status },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        product: {
          select: { id: true, name: true, sku: true, stockQuantity: true, costPrice: true },
        },
      },
    });
  }

  /** Approve → apply price + record history in one atomic transaction. */
  async approve(suggestionId: string) {
    const { storeId } = TenantContext.require();
    return this.prisma.$transaction(async (tx) => {
      const suggestion = await tx.priceSuggestion.findFirst({
        where: { id: suggestionId, storeId, status: 'PENDING' },
      });
      if (!suggestion) throw new NotFoundException('Pending suggestion not found');
      if (suggestion.expiresAt && suggestion.expiresAt < new Date()) {
        throw new BadRequestException('Suggestion has expired');
      }

      const now = new Date();
      await tx.product.update({
        where: { id: suggestion.productId },
        data: {
          price: suggestion.suggestedPrice,
          // Show the old price as "compare at" when raising
          ...(Number(suggestion.suggestedPrice) > Number(suggestion.currentPrice)
            ? { compareAtPrice: suggestion.currentPrice }
            : {}),
        },
      });
      await tx.priceSuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'APPROVED', appliedAt: now },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'store',
          aggregateId: storeId,
          eventType: 'ai.price.suggested',
          payload: {
            productId: suggestion.productId,
            action: 'approved',
            from: Number(suggestion.currentPrice),
            to: Number(suggestion.suggestedPrice),
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return { ok: true, appliedPrice: Number(suggestion.suggestedPrice) };
    });
  }

  async dismiss(suggestionId: string) {
    const { storeId } = TenantContext.require();
    const result = await this.prisma.priceSuggestion.updateMany({
      where: { id: suggestionId, storeId, status: 'PENDING' },
      data: { status: 'DISMISSED' },
    });
    if (result.count === 0) throw new NotFoundException('Pending suggestion not found');
    return { ok: true };
  }

  /** Ask the AI engine for a fresh optimization pass over this store. */
  async requestOptimization() {
    const { storeId } = TenantContext.require();
    const productCount = await this.prisma.product.count({
      where: { storeId, deletedAt: null, status: 'ACTIVE' },
    });
    if (productCount === 0) throw new BadRequestException('No active products to optimize');

    await this.rabbitmq.publish('ai.pricing.optimize', { storeId });
    return { ok: true, queuedProducts: productCount };
  }
}
