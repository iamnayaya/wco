import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';

/**
 * Claude API client with OpenAI fallback, retry logic, rate limiting,
 * and cost tracking. This is the core LLM integration for the AI Engine.
 *
 * Contract: `complete()` resolves with structured result or throws after
 * retries are exhausted. Callers always have a heuristic fallback path.
 */

export type LLMProvider = 'anthropic' | 'openai';

export interface LLMRequest {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly provider?: LLMProvider;
}

export interface LLMResult {
  readonly text: string;
  readonly provider: LLMProvider;
  readonly model: string;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly latencyMs: number;
  readonly cached: boolean;
}

export interface RateLimitState {
  anthropic: { remaining: number; resetAt: number };
  openai: { remaining: number; resetAt: number };
}

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

const rateLimits: RateLimitState = {
  anthropic: { remaining: 60, resetAt: 0 },
  openai: { remaining: 60, resetAt: 0 },
};

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');

  if (remaining !== null) {
    const provider = url.includes('anthropic') ? 'anthropic' : 'openai';
    rateLimits[provider].remaining = parseInt(remaining, 10);
    if (reset !== null) rateLimits[provider].resetAt = Date.now() + parseInt(reset, 10) * 1000;
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after');
    const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
    throw new RateLimitError(providerName(url), waitMs);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ProviderError(providerName(url), res.status, text);
  }

  return res.json();
}

function providerName(url: string): LLMProvider {
  return url.includes('anthropic') ? 'anthropic' : 'openai';
}

export class RateLimitError extends Error {
  constructor(
    public readonly provider: LLMProvider,
    public readonly waitMs: number,
  ) {
    super(`Rate limit hit for ${provider}. Retry after ${waitMs}ms`);
    this.name = 'RateLimitError';
  }
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: LLMProvider,
    public readonly statusCode: number,
    public readonly body: string,
  ) {
    super(`${provider} API error ${statusCode}: ${body.slice(0, 200)}`);
    this.name = 'ProviderError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAnthropic(req: LLMRequest): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  if (!env.ANTHROPIC_API_KEY) throw new ProviderError('anthropic', 0, 'API key not configured');

  const model = req.model ?? 'claude-3-haiku-20240307';
  const json = (await postJson(
    'https://api.anthropic.com/v1/messages',
    {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    {
      model,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.userPrompt }],
    },
  )) as { content?: Array<{ text?: string }>; usage?: { input_tokens: number; output_tokens: number } };

  const text = json.content?.[0]?.text ?? '';
  return {
    text,
    inputTokens: json.usage?.input_tokens ?? 0,
    outputTokens: json.usage?.output_tokens ?? 0,
  };
}

async function callOpenAI(req: LLMRequest): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  if (!env.OPENAI_API_KEY) throw new ProviderError('openai', 0, 'API key not configured');

  const model = req.model ?? 'gpt-4o-mini';
  const json = (await postJson(
    'https://api.openai.com/v1/chat/completions',
    { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    {
      model,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    },
  )) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens: number; completion_tokens: number } };

  const text = json.choices?.[0]?.message?.content ?? '';
  return {
    text,
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
  };
}

async function callWithRetry(
  fn: () => Promise<{ text: string; inputTokens: number; outputTokens: number }>,
  provider: LLMProvider,
  retries: number = MAX_RETRIES,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (err instanceof RateLimitError) {
        const waitMs = err.waitMs + attempt * RETRY_BASE_MS;
        logger.warn('ai.rate-limit', { provider, waitMs, attempt });
        await sleep(waitMs);
        continue;
      }
      if (err instanceof ProviderError && err.statusCode >= 500) {
        const waitMs = RETRY_BASE_MS * Math.pow(2, attempt);
        logger.warn('ai.provider-retry', { provider, status: err.statusCode, attempt, waitMs });
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Primary LLM completion with provider fallback.
 * Tries the preferred provider first, then falls back to the other.
 */
export async function complete(req: LLMRequest): Promise<LLMResult> {
  const startedAt = Date.now();
  const preferred: LLMProvider = req.provider ?? (env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai');
  const fallback: LLMProvider = preferred === 'anthropic' ? 'openai' : 'anthropic';

  const tryProvider = async (provider: LLMProvider): Promise<LLMResult> => {
    const fn = provider === 'anthropic'
      ? () => callAnthropic(req)
      : () => callOpenAI(req);
    const result = await callWithRetry(fn, provider);
    return {
      text: result.text.trim(),
      provider,
      model: req.model ?? (provider === 'anthropic' ? 'claude-3-haiku-20240307' : 'gpt-4o-mini'),
      tokensInput: result.inputTokens,
      tokensOutput: result.outputTokens,
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  };

  try {
    return await tryProvider(preferred);
  } catch (primaryErr) {
    logger.warn('ai.fallback', {
      primary: preferred,
      fallback,
      error: (primaryErr as Error).message,
    });
    try {
      return await tryProvider(fallback);
    } catch (fallbackErr) {
      throw primaryErr;
    }
  }
}

/** Check if any LLM provider is available. */
export function llmAvailable(): boolean {
  return env.ANTHROPIC_API_KEY !== undefined || env.OPENAI_API_KEY !== undefined;
}

/** Get current rate limit state for monitoring. */
export function getRateLimits(): RateLimitState {
  return { ...rateLimits };
}
