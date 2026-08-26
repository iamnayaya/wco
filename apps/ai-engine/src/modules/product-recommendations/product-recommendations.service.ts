import { Injectable } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { EmbeddingsService } from '../../services/embeddings/embeddings.service';
import { VectorDBService } from '../../services/vector-db/vector-db.service';

/**
 * ProductRecommendationsService — "customers who bought X also buy Y" +
 * semantic fallback for catalogs too small for co-occurrence to work.
 *
 * Strategy ladder:
 *  1. Co-occurrence (order_items joins) — strongest signal, needs volume
 *  2. Same-category fallback
 *  3. Vector similarity via Pinecone (semantic: "matching bag" → kente clutches)
 */
@Injectable()
export class ProductRecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly vectorDb: VectorDBService,
  ) {}

  async recommend(storeId: string, productId: string, limit = 4): Promise<
    Array<{ id: string; name: string; price: number; reason: 'bought-together' | 'same-category' | 'similar' }>
  > {
    const coOccurring = await this.boughtTogether(storeId, productId, limit);
    if (coOccurring.length >= limit) return coOccurring;

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
      select: { id: true, categoryId: true, name: true, description: true },
    });
    if (!product) return coOccurring;

    if (product.categoryId && coOccurring.length < limit) {
      const sameCategory = await this.prisma.product.findMany({
        where: {
          storeId, deletedAt: null, status: 'ACTIVE',
          categoryId: product.categoryId, id: { not: productId, notIn: coOccurring.map((p) => p.id) },
        },
        select: { id: true, name: true, price: true },
        take: limit - coOccurring.length,
      });
      coOccurring.push(...sameCategory.map((p) => ({ ...p, reason: 'same-category' as const })));
    }

    if (coOccurring.length < limit && this.vectorDb.isConfigured()) {
      try {
        const queryVector = await this.embeddings.embedOne(
          `${product.name} ${product.description ?? ''}`,
        );
        const similar = await this.vectorDb.search(storeId, queryVector, limit + 1);
        for (const match of similar) {
          if (match.id === productId || coOccurring.some((c) => c.id === match.id)) continue;
          const found = await this.prisma.product.findFirst({
            where: { id: match.id, storeId, status: 'ACTIVE', deletedAt: null },
            select: { id: true, name: true, price: true },
          });
          if (found) {
            coOccurring.push({ ...found, reason: 'similar' });
            if (coOccurring.length >= limit) break;
          }
        }
      } catch {
        // Semantic tier is best-effort — never block recommendations
      }
    }

    return coOccurring.slice(0, limit);
  }

  /** Re-index a store's catalog into the vector DB (catalog change hook). */
  async reindexStore(storeId: string): Promise<number> {
    if (!this.vectorDb.isConfigured()) return 0;

    const products = await this.prisma.product.findMany({
      where: { storeId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, description: true, price: true },
      take: 2000,
    });
    if (products.length === 0) return 0;

    const vectors = await this.embeddings.embedBatch(
      products.map((p) => `${p.name}. ${p.description ?? ''}`),
    );
    return this.vectorDb.upsertProducts(
      storeId,
      products.map((p, i) => ({
        id: p.id,
        vector: vectors[i],
        text: `${p.name}. ${p.description ?? ''}`,
        metadata: { name: p.name, price: Number(p.price) },
      })),
    );
  }

  private async boughtTogether(storeId: string, productId: string, limit: number) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; name: string; price: unknown; score: bigint }>>`
      SELECT p.id, p.name, p.price, COUNT(*) AS score
      FROM order_items a
      JOIN order_items b ON b.order_id = a.order_id AND b.product_id != a.product_id
      JOIN products p ON p.id = b.product_id
      JOIN orders o ON o.id = a.order_id
      WHERE a.product_id = ${productId}
        AND o.store_id = ${storeId}
        AND o.status NOT IN ('CANCELLED', 'REFUNDED')
        AND p.status = 'ACTIVE' AND p.deleted_at IS NULL
      GROUP BY p.id, p.name, p.price
      ORDER BY score DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: Number(r.price),
      reason: 'bought-together' as const,
    }));
  }
}
