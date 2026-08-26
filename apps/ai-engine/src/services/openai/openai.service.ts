import OpenAI from 'openai';
import { Injectable, Logger } from '@nestjs/common';

/**
 * OpenAIService — fallback LLM provider + embedding generation.
 *
 * Role in the degradation ladder:
 *   Claude Haiku (primary) -> GPT-4o-mini (this file) -> template fallback.
 *
 * Shares the same circuit-breaker discipline as ClaudeService so a provider
 * outage never cascades into webhook handler timeouts.
 */
@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly client: OpenAI;

  private failures = 0;
  private openedAt: number | null = null;
  private static readonly FAILURE_THRESHOLD = 5;
  private static readonly COOLDOWN_MS = 30_000;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
    });
  }

  get isAvailable(): boolean {
    if (this.openedAt === null) return true;
    if (Date.now() - this.openedAt > OpenAIService.COOLDOWN_MS) {
      this.openedAt = null;
      this.failures = 0;
      return true;
    }
    return false;
  }

  async *stream(request: {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
    temperature?: number;
    model?: string;
  }): AsyncGenerator<string, void, unknown> {
    if (!this.isAvailable) throw new CircuitOpenError('OpenAI circuit open');

    try {
      const stream = await this.client.chat.completions.create({
        model: request.model ?? 'gpt-4o-mini',
        max_tokens: request.maxTokens ?? 512,
        temperature: request.temperature ?? 0.7,
        messages: [{ role: 'system', content: request.systemPrompt }, ...request.messages],
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
      this.recordSuccess();
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  async complete(request: {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
    model?: string;
  }): Promise<string> {
    if (!this.isAvailable) throw new CircuitOpenError('OpenAI circuit open');

    try {
      const response = await this.client.chat.completions.create({
        model: request.model ?? 'gpt-4o-mini',
        max_tokens: request.maxTokens ?? 256,
        temperature: request.temperature ?? 0.3,
        ...(request.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        messages: [
          ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
          { role: 'user' as const, content: request.prompt },
        ],
      });

      this.recordSuccess();
      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  /** Batched embeddings — catalog indexing & semantic cache keys. */
  async embed(texts: string[], model?: string): Promise<number[][]> {
    if (texts.length === 0) return [];
    // Truncate per-token limits; embedding quality loss is negligible here
    const input = texts.map((t) => t.slice(0, 8000));
    const response = await this.client.embeddings.create({
      model: model ?? process.env.EMBEDDING_MODEL ?? 'text-embedding-3-large',
      input,
      dimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 1536),
    });
    return response.data.map((d) => d.embedding);
  }

  private recordSuccess(): void {
    this.failures = 0;
  }

  private recordFailure(error: unknown): void {
    const status = (error as { status?: number }).status ?? 0;
    const retryable = status === 429 || status >= 500 || status === 0;
    if (!retryable) return;

    this.failures += 1;
    if (this.failures >= OpenAIService.FAILURE_THRESHOLD && !this.openedAt) {
      this.openedAt = Date.now();
      this.logger.error('openai.circuit.opened');
    }
  }
}

export class CircuitOpenError extends Error {}
