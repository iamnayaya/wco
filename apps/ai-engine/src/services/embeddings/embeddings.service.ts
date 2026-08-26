import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';

/**
 * EmbeddingsService — semantic layer for product search & cache keys.
 * Wraps OpenAI embeddings with batching, in-memory LRU and retry.
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly cache = new Map<string, number[]>();
  private static readonly CACHE_MAX = 5_000;

  constructor(private readonly openai: OpenAIService) {}

  async embedOne(text: string): Promise<number[]> {
    const key = this.cacheKey(text);
    const hit = this.cache.get(key);
    if (hit) return hit;

    const [vector] = await this.openai.embed([text]);
    if (!vector) throw new Error('Embedding provider returned empty vector');

    this.remember(key, vector);
    return vector;
  }

  /** Batched — catalog re-index jobs pass hundreds of products at once. */
  async embedBatch(texts: string[], batchSize = 96): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const slice = texts.slice(i, i + batchSize);
      const vectors = await this.withRetry(() => this.openai.embed(slice), 3);
      results.push(...vectors);
      this.logger.debug({ batch: i / batchSize + 1 }, 'embeddings.batch.done');
    }
    return results;
  }

  /** Cosine similarity — sufficient precision at our scale, zero deps. */
  static cosine(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }

  private async withRetry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        await new Promise((r) => setTimeout(r, 2 ** attempt * 250));
      }
    }
    throw lastError;
  }

  private remember(key: string, vector: number[]): void {
    if (this.cache.size >= EmbeddingsService.CACHE_MAX) {
      // Evict oldest insertion (FIFO is fine for hot-catalog access patterns)
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, vector);
  }

  private cacheKey(text: string): string {
    return text.slice(0, 512).toLowerCase();
  }
}
