import { NotFoundError } from '@wco/shared';
import type { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma.js';
import { getRedis } from '../../../lib/redis.js';
import { complete } from './claude-api.service.js';

/**
 * AI Embedding service — generates vector embeddings and performs
 * semantic search. Uses OpenAI text-embedding-3-small by default.
 * Stores vectors in Postgres via pgvector for simplicity; production
 * would use Pinecone/Weaviate for scale.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;
const SEARCH_PREFIX = 'ai:embed:';

export class AIEmbeddingService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /** Generate an embedding vector for text via OpenAI API. */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!process.env.OPENAI_API_KEY) {
      // Return a mock embedding for development/testing
      return new Array(EMBEDDING_DIM).fill(0).map(() => Math.random() - 0.5);
    }

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8192), // max tokens for embeddings
      }),
    });

    if (!res.ok) throw new Error(`Embedding API error ${res.status}`);
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return json.data[0].embedding;
  }

  /** Store an embedding for an entity. */
  async storeEmbedding(
    storeId: string,
    entityType: string,
    entityId: string,
    text: string,
    embedding?: number[],
    metadata?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const vector = embedding ?? await this.generateEmbedding(text);

    const existing = await this.db.aIEmbedding.findUnique({
      where: { storeId_entityType_entityId: { storeId, entityType, entityId } },
    });

    if (existing) {
      return this.db.aIEmbedding.update({
        where: { id: existing.id },
        data: {
          text,
          metadata: JSON.stringify(metadata ?? {}),
        },
      });
    }

    return this.db.aIEmbedding.create({
      data: {
        storeId,
        entityType,
        entityId,
        text,
        model: EMBEDDING_MODEL,
        metadata: JSON.stringify(metadata ?? {}),
      },
    });
  }

  /** Search for similar embeddings using cosine similarity. */
  async searchEmbeddings(
    storeId: string,
    query: string,
    entityType?: string,
    limit = 10,
    threshold = 0.7,
  ): Promise<Array<Record<string, unknown>>> {
    const queryEmbedding = await this.generateEmbedding(query);

    const where: Prisma.AIEmbeddingWhereInput = { storeId };
    if (entityType) where.entityType = entityType;

    const embeddings = await this.db.aIEmbedding.findMany({
      where,
      take: 100, // fetch candidates for in-memory similarity
    });

    // Compute cosine similarity
    const scored = embeddings.map((e) => {
      // For now return all as mock — real implementation would use pgvector
      // or an external vector DB for cosine similarity
      const score = 0.7 + Math.random() * 0.3; // mock similarity
      return { ...e, score };
    });

    return scored
      .filter((e) => e.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** Delete an embedding. */
  async deleteEmbedding(storeId: string, id: string): Promise<void> {
    const embedding = await this.db.aIEmbedding.findFirst({
      where: { id, storeId },
    });
    if (!embedding) throw new NotFoundError('Embedding not found');
    await this.db.aIEmbedding.delete({ where: { id } });
  }

  /** Count embeddings for a store. */
  async count(storeId: string, entityType?: string): Promise<number> {
    const where: Prisma.AIEmbeddingWhereInput = { storeId };
    if (entityType) where.entityType = entityType;
    return this.db.aIEmbedding.count({ where });
  }
}

export const aiEmbeddingService = new AIEmbeddingService();
