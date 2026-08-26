import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * VectorDBService — Pinecone wrapper for product embeddings.
 *
 * Namespace strategy: one namespace per store (`store_<storeId>`) keeps
 * tenant data physically separated inside the index and makes bulk deletes
 * on catalog rebuilds a single deleteAll call.
 */
@Injectable()
export class VectorDBService implements OnModuleInit {
  private readonly logger = new Logger(VectorDBService.name);
  // Lazily imported to keep unit tests dependency-free
  private client: {
    Index: new (config: { apiKey: string; indexHost?: string }) => PineconeIndex;
  } | null = null;
  private index: PineconeIndex | null = null;

  async onModuleInit(): Promise<void> {
    if (!process.env.PINECONE_API_KEY) {
      this.logger.warn('vector-db.disabled — PINECONE_API_KEY missing; RAG degraded');
      return;
    }
    const { Pinecone } = await import('@pinecone-database/pinecone');
    this.client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    }) as unknown as { Index: new (config: { apiKey: string }) => PineconeIndex };
  }

  isConfigured(): boolean {
    return this.index !== null || Boolean(process.env.PINECONE_API_KEY);
  }

  /** Upsert product vectors into the store's namespace. */
  async upsertProducts(
    storeId: string,
    records: Array<{ id: string; vector: number[]; text: string; metadata: Record<string, string | number> }>,
  ): Promise<number> {
    const ns = await this.namespace(storeId);
    if (!ns) return 0;

    await ns.upsert(records.map((r) => ({
      id: r.id,
      values: r.vector,
      metadata: { ...r.metadata, text: r.text.slice(0, 1000) },
    })));
    return records.length;
  }

  /** Nearest products for RAG context building. */
  async search(
    storeId: string,
    queryVector: number[],
    topK = 5,
  ): Promise<Array<{ id: string; score: number; text?: string; metadata?: Record<string, unknown> }>> {
    const ns = await this.namespace(storeId);
    if (!ns) return [];

    const result = await ns.query({ vector: queryVector, topK, includeMetadata: true });
    return (result.matches ?? []).map((m) => ({
      id: m.id,
      score: m.score ?? 0,
      text: (m.metadata as { text?: string } | undefined)?.text,
      metadata: m.metadata as Record<string, unknown> | undefined,
    }));
  }

  /** Catalog rebuild — wipe namespace before re-indexing. */
  async resetStore(storeId: string): Promise<void> {
    const ns = await this.namespace(storeId);
    if (!ns) return;
    await ns.deleteAll();
  }

  private async namespace(storeId: string): Promise<PineconeNamespace | null> {
    if (!this.index && this.client && process.env.PINECONE_API_KEY) {
      this.index = new this.client.Index({ apiKey: process.env.PINECONE_API_KEY });
    }
    if (!this.index) return null;
    return this.index.namespace(`store_${storeId}`);
  }
}

// Minimal structural types so we don't import Pinecone types at module scope
interface PineconeIndex {
  namespace(name: string): PineconeNamespace;
}
interface PineconeNamespace {
  upsert(records: Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }>): Promise<unknown>;
  query(request: { vector: number[]; topK: number; includeMetadata?: boolean }): Promise<{
    matches?: Array<{ id: string; score?: number; metadata?: unknown }>;
  }>;
  deleteAll(): Promise<unknown>;
}
