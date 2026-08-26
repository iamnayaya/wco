import { env } from '../../../config/env.js';

/**
 * LLM seam for the auto-responder.
 *
 * Contract: `draftReply` resolves to null whenever no provider key is
 * configured or the call fails - callers ALWAYS have a deterministic
 * heuristic fallback, so the pipeline is testable and never hard-fails on
 * vendor outages.
 */

export type LlmModel = 'claude-3-haiku' | 'gpt-4o-mini';

export interface DraftContext {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly model: LlmModel;
  readonly temperature: number;
  readonly maxTokens: number;
}

const REQUEST_TIMEOUT_MS = 12_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  return (await res.json());
}

async function draftWithAnthropic(ctx: DraftContext): Promise<string> {
  const json = (await postJson(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
    {
      model: ctx.model,
      max_tokens: ctx.maxTokens,
      temperature: ctx.temperature,
      system: ctx.systemPrompt,
      messages: [{ role: 'user', content: ctx.userPrompt }],
    },
  )) as { content?: Array<{ text?: unknown }> };
  const first = json.content?.[0]?.text;
  return typeof first === 'string' ? first : '';
}

async function draftWithOpenai(ctx: DraftContext): Promise<string> {
  const json = (await postJson(
    'https://api.openai.com/v1/chat/completions',
    { authorization: `Bearer ${env.OPENAI_API_KEY ?? ''}` },
    {
      model: ctx.model,
      max_tokens: ctx.maxTokens,
      temperature: ctx.temperature,
      messages: [
        { role: 'system', content: ctx.systemPrompt },
        { role: 'user', content: ctx.userPrompt },
      ],
    },
  )) as { choices?: Array<{ message?: { content?: unknown } }> };
  const first = json.choices?.[0]?.message?.content;
  return typeof first === 'string' ? first : '';
}

/** Returns the reply text, or null when no key is set / the call fails. */
export async function draftReply(ctx: DraftContext): Promise<string | null> {
  try {
    let text: string | null = null;
    if (ctx.model === 'claude-3-haiku' && env.ANTHROPIC_API_KEY !== undefined) {
      text = await draftWithAnthropic(ctx);
    } else if (ctx.model === 'gpt-4o-mini' && env.OPENAI_API_KEY !== undefined) {
      text = await draftWithOpenai(ctx);
    }
    if (text !== null && text.trim().length > 0) return text.trim();
    return null;
  } catch {
    // Vendor outage / timeout / bad key - heuristic path takes over.
    return null;
  }
}

export function llmConfigured(): boolean {
  return env.ANTHROPIC_API_KEY !== undefined || env.OPENAI_API_KEY !== undefined;
}
