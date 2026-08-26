import type { AiConfiguration, Conversation, EscalationReason } from '@prisma/client';
import { ROUTING_KEYS } from '@wco/shared';

import { env } from '../../../config/env.js';
import { enqueueAiRespond } from '../../../jobs/queues.js';
import { prisma } from '../../../lib/prisma.js';
import { publishDomainEvent } from '../../../lib/rabbit.js';

import { escalationsService } from './escalations.service.js';
import { draftReply, llmConfigured } from './llm.client.js';
import { messagesService } from './messages.service.js';
import {
  detectIntent,
  detectLanguage,
  extractEntities,
  renderTemplate,
  scoreConfidence,
  withinSessionWindow,
  type CustomIntentInput,
  type Entities,
  type IntentMatch,
  type LangCode,
} from './nlp.service.js';

/**
 * AI auto-responder turn pipeline.
 *
 *   inbound persisted -> classify -> escalate-or-draft -> grounded reply
 *
 * Escalation gate (any hit pages a human, bot stays silent):
 *   - store-taught keyword list
 *   - hard intents: COMPLAINT / REFUND / HUMAN_REQUEST
 *   - confidence below the store's threshold
 * Drafting: LLM when a key is configured, deterministic heuristic otherwise -
 * every reply is grounded in catalog hits from extracted entities.
 */

export interface TurnInput {
  readonly storeId: string;
  readonly conversationId: string;
  readonly waMessageId: string;
}

export interface TurnOutcome {
  readonly status: 'REPLIED' | 'ESCALATED' | 'SKIPPED' | 'NO_TEXT';
  readonly intent: string | null;
  readonly confidence: number | null;
  readonly replyMessageId: string | null;
  readonly escalationId: string | null;
}

/** Queue vs inline is read at call time so tests can flip it per-spec. */
export function aiProcessingMode(): 'queue' | 'inline' {
  const raw = process.env.AI_PROCESSING_MODE;
  if (raw === 'inline' || raw === 'queue') return raw;
  return env.AI_PROCESSING_MODE;
}

interface Classification {
  readonly match: IntentMatch;
  readonly entities: Entities;
  readonly language: LangCode;
  readonly confidence: number;
  /** Store-taught intents considered during this turn (for canned lookups). */
  readonly customIntents: ReadonlyArray<{ name: string; cannedResponse: string | null }>;
  readonly text: string;
}

interface LogPayload {
  status: TurnOutcome['status'];
  intent: string | null;
  confidence: number | null;
  replyMessageId: string | null;
  escalationId: string | null;
  language: string;
  source: 'llm' | 'heuristic';
  model: string | null;
  escalated: boolean;
  outboundMessageId?: string;
}

/** Built-in intents that always page a human, mapped to escalation reasons. */
function hardEscalationReason(intent: string): EscalationReason | undefined {
  if (intent === 'COMPLAINT') return 'COMPLAINT';
  if (intent === 'REFUND') return 'REFUND_REQUEST';
  if (intent === 'HUMAN_REQUEST') return 'HUMAN_REQUESTED';
  return undefined;
}

interface DraftResult {
  body: string;
  source: 'llm' | 'heuristic';
  model: string | null;
}

type EligibleTurn =
  | { readonly kind: 'skip' }
  | { readonly kind: 'noText'; readonly thread: Conversation; readonly config: AiConfiguration }
  | {
      readonly kind: 'ready';
      readonly thread: Conversation;
      readonly config: AiConfiguration;
      readonly store: { readonly id: string; readonly name: string };
      readonly message: { readonly id: string; readonly body: string; readonly createdAt: Date };
    };

/** Out-of-hours replaces any draft with the store's away note. */
function applyOutOfHours(config: AiConfiguration, draft: DraftResult, storeName: string): void {
  if (isWithinWorkingHours(config.workingHours as unknown, new Date())) return;
  const ooo = config.outOfOfficeBody;
  if (typeof ooo === 'string' && ooo.trim().length > 0) {
    draft.body = renderTemplate(ooo, { storeName });
    draft.source = 'heuristic';
  }
}

interface WorkingHoursShape {
  start?: unknown;
  end?: unknown;
  days?: unknown;
}

function parseClock(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function isWithinWorkingHours(raw: unknown, now: Date): boolean {
  const wh = (raw ?? {}) as WorkingHoursShape;
  const start = parseClock(wh.start);
  const end = parseClock(wh.end);
  if (start === null || end === null) return true;
  const days = Array.isArray(wh.days) ? wh.days.filter((d): d is number => typeof d === 'number') : [];
  if (days.length > 0 && !days.includes(now.getUTCDay())) return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutes >= start && minutes <= end;
}

export const CANNED_REPLIES: Record<string, string> = {
  GREETING: 'Hi! Welcome to {{storeName}}. How can we help you today?',
  PRICE_INQUIRY:
    'Thanks for your interest! Here is what we have available: {{productList}}. Which one would you like?',
  PRODUCT_AVAILABILITY:
    '{{productList}} is available right now. Would you like us to reserve one for you?',
  PRODUCT_INFO:
    'Here are details on what you asked about: {{productList}}. Let us know if you need anything more specific.',
  ORDER_INTENT: 'Great choice! Please confirm the item(s) and your delivery address so we can process it.',
  PAYMENT: 'You can pay via bank transfer or card link - we will send payment details once your order is confirmed.',
  DELIVERY: 'We deliver nationwide. Delivery within Lagos takes 1-2 days; other states 2-5 days.',
  SMALL_TALK: 'Happy to help with anything about our store - just ask!',
};

export const GENERIC_REPLY =
  'Thanks for reaching out to {{storeName}}! An agent will confirm the details shortly.';

export class ResponderService {
  /** Webhook ingress hook: persist then dispatch the turn queue-vs-inline. */
  async ingestAndDispatch(inbound: {
    storePhoneNumberId: string;
    waMessageId: string;
    fromPhone: string;
    type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'template' | 'interactive';
    body: string | null;
    mediaUrl: string | null;
    timestamp: Date;
  }): Promise<{ conversationId: string; duplicated: boolean; direction?: string; type?: string; status?: string }> {
    // Reuse the legacy ingestion pipeline: dedupe on waMessageId, customer +
    // thread upsert, unread bump, MESSAGE_INBOUND event.
    const { conversationsService } = await import('../../../services/conversations.service.js');
    const { conversation, duplicated } = await conversationsService.receiveInbound(inbound);
    if (!duplicated) {
      await this.dispatchTurn({ storeId: conversation.storeId, conversationId: conversation.id, waMessageId: inbound.waMessageId });
    }
    // Fetch the persisted inbound message to return its properties to the caller.
    const msg = await prisma.message.findUnique({ where: { waMessageId: inbound.waMessageId } });
    return {
      conversationId: conversation.id,
      duplicated,
      direction: msg?.direction,
      type: msg?.type,
      status: msg?.status,
    };
  }

  async dispatchTurn(input: TurnInput): Promise<void> {
    if (aiProcessingMode() === 'inline') {
      await this.processTurn(input).catch(() => undefined);
      return;
    }
    await enqueueAiRespond({
      waMessageId: input.waMessageId,
      storeId: input.storeId,
      conversationId: input.conversationId,
    });
  }

  /**
   * One full classification + reply cycle. Never throws for "nothing to do"
   * cases (bot off, media-only) - those are SKIPPED outcomes; only unexpected
   * infrastructure failures throw so BullMQ retries them.
   */
  async processTurn(input: TurnInput): Promise<TurnOutcome> {
    const startedAt = Date.now();
    const turn = await this.loadEligibleTurn(input);
    if (turn.kind === 'skip') return this.skippedOutcome();
    if (turn.kind === 'noText') {
      return this.logTurn(turn.config, turn.thread.id, input, startedAt, this.turnLog('NO_TEXT'));
    }

    const { thread, config, store, message } = turn;
    const classification = await this.classify(input.storeId, message.body);
    const escalationId = await this.runEscalationGate(thread, message.id, config, classification);
    if (escalationId !== null) {
      return this.logTurn(config, thread.id, input, startedAt, {
        ...this.turnLog('ESCALATED', classification),
        escalationId,
        escalated: true,
      });
    }

    const productList = await this.groundProducts(input.storeId, classification.entities.productHints);
    const draft = await this.draftReplyBody(config, store.name, classification, productList);
    applyOutOfHours(config, draft, store.name);

    if (!withinSessionWindow(message.createdAt, new Date()) && draft.source === 'heuristic') {
      // Outside WhatsApp's 24h window only template-class sends are legal;
      // heuristic free-text would get the number flagged, so defer to humans.
      return this.logTurn(config, thread.id, input, startedAt, this.turnLog('SKIPPED', classification));
    }

    const reply = await messagesService.send(input.storeId, thread.id, {
      type: 'TEXT',
      body: draft.body,
      sentByBot: true,
    });
    return this.logTurn(config, thread.id, input, startedAt, {
      ...this.turnLog('REPLIED', classification),
      replyMessageId: reply.id,
      source: draft.source,
      model: draft.model,
      outboundMessageId: reply.id,
    });
  }

  /** Loads the turn and decides eligibility - keeps processTurn linear. */
  private async loadEligibleTurn(input: TurnInput): Promise<EligibleTurn> {
    const [thread, config, store] = await Promise.all([
      prisma.conversation.findFirst({ where: { id: input.conversationId, storeId: input.storeId } }),
      prisma.aiConfiguration.findUnique({ where: { storeId: input.storeId } }),
      prisma.store.findUnique({ where: { id: input.storeId }, select: { id: true, name: true } }),
    ]);
    const botActive =
      thread !== null && config !== null && store !== null &&
      config.isEnabled && config.autoReplyEnabled &&
      thread.botEnabled && thread.status === 'BOT';
    if (!botActive) return { kind: 'skip' };

    const message = await prisma.message.findUnique({ where: { waMessageId: input.waMessageId } });
    if (message === null || message.body === null || message.body.trim().length === 0) {
      return { kind: 'noText', thread, config } as const;
    }
    return {
      kind: 'ready',
      thread,
      config,
      store,
      message: { id: message.id, body: message.body, createdAt: message.createdAt },
    } as const;
  }

  private skippedOutcome(intent: string | null = null): TurnOutcome {
    return { status: 'SKIPPED', intent, confidence: null, replyMessageId: null, escalationId: null };
  }

  /** Minimal log payload shared by NO_TEXT / SKIPPED paths. */
  private turnLog(status: TurnOutcome['status'], classification?: Classification): LogPayload {
    return {
      status,
      intent: classification?.match.intent ?? null,
      confidence: classification?.confidence ?? null,
      replyMessageId: null,
      escalationId: null,
      language: classification?.language ?? 'en',
      source: 'heuristic',
      model: null,
      escalated: false,
    };
  }

  private async classify(storeId: string, text: string): Promise<Classification> {
    const customIntents = await prisma.aiIntent.findMany({
      where: { storeId, isActive: true },
      orderBy: { priority: 'desc' },
    });
    const match = detectIntent(text, customIntents satisfies CustomIntentInput[]);
    const entities = extractEntities(text);
    const language = detectLanguage(text);
    const confidence = scoreConfidence(match.confidence, language, Object.keys(entities).length > 0);
    return {
      match,
      entities,
      language,
      confidence,
      customIntents: customIntents.map((ci) => ({ name: ci.name, cannedResponse: ci.cannedResponse })),
      text,
    };
  }

  /** Returns the new escalation id, or null when the bot may answer. */
  private async runEscalationGate(
    thread: Conversation,
    messageId: string,
    config: AiConfiguration,
    classification: Classification,
  ): Promise<string | null> {
    const lowerText = classification.text.toLowerCase();
    const keywordHit = config.escalationKeywords.some(
      (k) => k.length > 0 && lowerText.includes(k.toLowerCase()),
    );
    const hardReason = hardEscalationReason(classification.match.intent);
    const belowThreshold = classification.confidence < Number(config.confidenceThreshold);
    if (!keywordHit && hardReason === undefined && !belowThreshold) return null;

    const reason: EscalationReason = hardReason ?? 'LOW_CONFIDENCE';
    const escalation = await escalationsService.create(thread.storeId, {
      threadId: thread.id,
      messageId,
      reason,
      notes: `Auto-escalated: intent=${classification.match.intent} confidence=${classification.confidence.toFixed(2)}${keywordHit ? ' keyword-hit' : ''}`,
    }, null);
    return escalation.id;
  }

  /**
   * LLM-first drafting with deterministic fallback: primary model -> fallback
   * model -> taught canned response -> built-in template.
   */
  private async draftReplyBody(
    config: AiConfiguration,
    storeName: string,
    classification: Classification,
    productList: string,
  ): Promise<{ body: string; source: 'llm' | 'heuristic'; model: string | null }> {
    const temperature = Number(config.temperature);
    const catalogLine = productList.length > 0 ? `Catalog matches: ${productList}.` : '';
    const userPrompt = `Customer says: "${classification.text}". Draft one helpful reply.`;

    if (llmConfigured()) {
      const systemPrompt = [
        `You are the WhatsApp sales assistant for ${storeName}.`,
        `Tone: ${config.tone.toLowerCase()}. Reply in ${classification.language}.`,
        'Keep replies under 300 characters. Never invent prices or stock levels.',
        config.businessContext ?? '',
        catalogLine,
      ].filter((line) => line.length > 0).join(' ');

      const primary = await draftReply({
        systemPrompt,
        userPrompt,
        model: config.primaryModel as 'claude-3-haiku',
        temperature,
        maxTokens: config.maxTokens,
      });
      if (primary !== null) return { body: primary, source: 'llm', model: config.primaryModel };

      const fallback = await draftReply({
        systemPrompt: `You are the WhatsApp assistant for ${storeName}. Reply under 300 characters.`,
        userPrompt,
        model: config.fallbackModel as 'gpt-4o-mini',
        temperature,
        maxTokens: config.maxTokens,
      });
      if (fallback !== null) return { body: fallback, source: 'llm', model: config.fallbackModel };
    }

    // Deterministic path - also the answer of record for tests.
    const taught = classification.customIntents.find((ci) => ci.name === classification.match.intent)?.cannedResponse;
    let template = GENERIC_REPLY;
    if (typeof taught === 'string') {
      template = taught;
    } else if (classification.match.intent in CANNED_REPLIES) {
      template = CANNED_REPLIES[classification.match.intent];
    }
    return {
      body: renderTemplate(template, {
        storeName,
        productList: productList.length > 0 ? productList : 'our catalogue',
      }),
      source: 'heuristic',
      model: null,
    };
  }

  private async groundProducts(storeId: string, hints: readonly string[]): Promise<string> {
    const selected = hints.slice(0, 3);
    if (selected.length === 0) return '';
    const products = await prisma.product.findMany({
      where: {
        storeId,
        status: 'ACTIVE',
        OR: selected.map((hint) => ({ name: { contains: hint, mode: 'insensitive' as const } })),
      },
      select: { name: true },
      take: 5,
    });
    return products.map((p) => p.name).join(', ');
  }

  private async logTurn(
    config: AiConfiguration,
    threadId: string,
    input: TurnInput,
    startedAt: number,
    data: LogPayload,
  ): Promise<TurnOutcome> {
    const inboundRow = await prisma.message.findUnique({ where: { waMessageId: input.waMessageId } });
    await prisma.aiResponseLog.create({
      data: {
        storeId: input.storeId,
        threadId,
        inboundMessageId: inboundRow?.id ?? null,
        outboundMessageId: data.outboundMessageId ?? null,
        intent: data.intent ?? 'UNKNOWN',
        confidence: data.confidence ?? 0,
        entities: {},
        language: data.language,
        source: data.source,
        model: data.model,
        escalated: data.escalated,
        latencyMs: Date.now() - startedAt,
      },
    });
    void publishDomainEvent(ROUTING_KEYS.MESSAGE_INBOUND, {
      kind: 'ai.turn.completed',
      storeId: input.storeId,
      conversationId: threadId,
      outcome: data.status,
      intent: data.intent,
      escalated: data.escalated,
    }).catch(() => undefined);
    return {
      status: data.status,
      intent: data.intent,
      confidence: data.confidence,
      replyMessageId: data.replyMessageId,
      escalationId: data.escalationId,
    };
  }
}

export const responderService = new ResponderService();
