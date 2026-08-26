import { Global, Module } from '@nestjs/common';
import { ClaudeService } from './claude/claude.service';
import { OpenAIService } from './openai/openai.service';
import { EmbeddingsService } from './embeddings/embeddings.service';
import { VectorDBService } from './vector-db/vector-db.service';

/**
 * AiServicesModule — the LLM/embedding/vector abstraction layer.
 *
 * Registered once as @Global() so every feature module can inject
 * ClaudeService, OpenAIService, EmbeddingsService and VectorDBService
 * without import plumbing — and so all modules share ONE instance of each
 * (circuit-breaker state, connection pools and caches must be process-wide,
 * not per-module).
 */
@Global()
@Module({
  providers: [ClaudeService, OpenAIService, EmbeddingsService, VectorDBService],
  exports: [ClaudeService, OpenAIService, EmbeddingsService, VectorDBService],
})
export class AiServicesModule {}
