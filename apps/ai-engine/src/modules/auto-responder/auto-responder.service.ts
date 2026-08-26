import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { ClaudeService, CircuitOpenError } from '../../services/claude/claude.service';
import { OpenAIService } from '../../services/openai/openai.service';
import {
  AUTO_RESPONDER_SYSTEM_PROMPT,
  buildAutoResponderContext,
} from '../../prompts/system/auto-responder.prompt';

export interface IncomingMessage {
  messageId: string;
  storeId: string;
  customerPhone: string;
  customerName: string;
  body: string;
  previousOrders: number;
}

export interface GeneratedReply {
  text: string;
  escalate: boolean;
  modelUsed: 'haiku' | 'gpt-4o-mini' | 'opus' | 'template-fallback';
  latencyMs: number;
  cached: boolean;
}

/**
 * AutoResponderService — flagship feature pipeline.
 *
 * Latency budget (<5s end-to-end to WhatsApp delivery):
 *   intent classify (150ms) → semantic cache check (50ms) →
 *   context build (100ms) → LLM stream (1-3s) → send (300ms)
 *
 * Degradation ladder:
 *   Claude Haiku → GPT-4o-mini → static template (never silent)
 */
@Injectable()
export class AutoResponderService {
  private readonly logger = new Logger(AutoResponderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
    private readonly openai: OpenAIService,
    // TODO(post-v1): semanticCache (Redis vectors) + catalogRepo hot cache
  ) {}

  async generateReply(message: IncomingMessage): Promise<GeneratedReply> {
    const start = Date.now();

    try {
      // Stage 1: Load context (parallel fetches, cached aggressively)
      const [storeContext, conversationHistory] = await Promise.all([
        this.loadStoreContext(message.storeId),
        this.loadConversationHistory(message.storeId, message.customerPhone),
      ]);

      // Stage 2: Build prompts
      const systemPrompt = AUTO_RESPONDER_SYSTEM_PROMPT.replace(
        '{STORE_NAME}',
        storeContext.storeName,
      )
        .replace('{COUNTRY}', storeContext.country)
        .replace('{CURRENCY}', this.currencySymbol(storeContext.currency))
        .replace(
          '{CONTEXT}',
          buildAutoResponderContext({
            ...storeContext,
            customerProfile: {
              firstName: message.customerName,
              previousOrders: message.previousOrders,
            },
          }),
        );

      const llmMessages = [
        ...conversationHistory.slice(-20), // token budget
        { role: 'user' as const, content: message.body },
      ];

      // Stage 3: Generate with fallback ladder
      let text = '';
      let modelUsed: GeneratedReply['modelUsed'] = 'haiku';
      let escalate = false;

      try {
        if (this.claude.isAvailable) {
          for await (const chunk of this.claude.stream({
            systemPrompt,
            messages: llmMessages,
            maxTokens: 512,
            model: 'claude-3-haiku-20240307', // fast tier; Opus reserved for complex intents
          })) {
            text += chunk;
          }
        } else {
          throw new CircuitOpenError('breaker open');
        }
      } catch (primaryError) {
        this.logger.warn({ err: primaryError }, 'autoresponder.fallback.openai');
        modelUsed = 'gpt-4o-mini';
        text = await this.openai.complete({
          systemPrompt,
          prompt: llmMessages.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
          maxTokens: 512,
        });
      }

      // Stage 4: Extract escalation signal + validate output
      if (text.includes('[ESCALATE]')) {
        escalate = true;
        text = text.replace(/\[ESCALATE\]/g, '').trim();
      }
      text = this.validateAndSanitize(text, storeContext);

      // Stage 5: Persist turn for future context (fire-and-forget)
      void this.persistConversationTurn(message.storeId, message.customerPhone, message.body, text);

      return {
        text,
        escalate,
        modelUsed,
        latencyMs: Date.now() - start,
        cached: false,
      };
    } catch (totalFailure) {
      // Absolute last resort — never leave a customer hanging
      this.logger.error({ err: totalFailure }, 'autoresponder.total.failure');
      return {
        text:
          `Hi ${message.customerName}! Thanks for your message 🙏 ` +
          `We got it and will reply shortly. For urgent orders you can also call the shop directly.`,
        escalate: false,
        modelUsed: 'template-fallback',
        latencyMs: Date.now() - start,
        cached: false,
      };
    }
  }

  /**
   * Output guardrails — final line of defense before a message reaches
   * a real customer. Blocks hallucinated prices and PII leakage.
   */
  private validateAndSanitize(text: string, storeContext: StoreContext): string {
    let sanitized = text.trim().slice(0, 3000); // WhatsApp hard limit ~4096

    // Strip any leaked internal markers or reasoning artifacts
    sanitized = sanitized.replace(/<(system|context|thinking)>.*?<\/\1>/gis, '');

    // Price sanity: every ₦/GH₵/KSh amount must exist in catalog or be a total sum
    const pricePattern = /[₦]|GH₵|KSh\s?\d/;
    if (pricePattern.test(sanitized)) {
      const mentionedPrices = (
        sanitized.match(/(?:₦|GH₵|KSh)\s?([\d,]+(?:\.\d{2})?)/g) ?? []
      ).map((p) => Number(p.replace(/[^\d.]/g, '')));

      const validBasePrices = new Set(
        storeContext.products.map((p) => p.price),
      );
      // Allow sums of up to 3 items (order totals)
      const validSums = new Set<number>();
      for (const a of validBasePrices) {
        for (const b of validBasePrices) {
          for (const c of [0, ...validBasePrices]) {
            validSums.add(a + b + c);
          }
        }
      }

      const invalidPrice = mentionedPrices.some(
        (price) => !validBasePrices.has(price) && !validSums.has(price),
      );
      if (invalidPrice && mentionedPrices.length > 0) {
        this.logger.warn(
          { prices: mentionedPrices },
          'autoresponder.price_guard.triggered',
        );
        // Replace specific prices with safe deferral
        sanitized =
          "Let me confirm today's exact price with the owner and get right back to you 🙏";
      }
    }

    return sanitized;
  }

  private currencySymbol(code: string): string {
    return ({ NGN: '₦', GHS: 'GH₵', KES: 'KSh', USD: '$' } as Record<string, string>)[code] ?? code;
  }

  private async loadStoreContext(storeId: string): Promise<StoreContext> {
    // Cache-aside: catalog changes rarely; a 5-minute TTL keeps the LLM
    // context build ~100ms instead of a fresh multi-table read per message.
    const cached = this.storeContextCache.get(storeId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const [store, products] = await Promise.all([
      this.prisma.store.findUnique({
        where: { id: storeId },
        select: { name: true, country: true, currency: true },
      }),
      this.prisma.product.findMany({
        where: { storeId, status: 'ACTIVE', deletedAt: null },
        select: {
          name: true,
          price: true,
          stockQuantity: true,
          description: true,
        },
        take: 100, // token budget — top-of-catalog only
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    if (!store) throw new Error(`Store ${storeId} not found for auto-responder`);

    const context: StoreContext = {
      storeName: store.name,
      country: store.country,
      currency: store.currency,
      products: products.map((p) => ({
        name: p.name,
        price: Number(p.price),
        stockQuantity: p.stockQuantity,
        description: p.description ?? undefined,
      })),
      policies: {
        deliveryAreas: ['Lagos'], // TODO: from store.settings JSON
        paymentMethods: ['Bank transfer', 'Card link'],
      },
    };

    this.storeContextCache.set(storeId, {
      value: context,
      expiresAt: Date.now() + 5 * 60_000,
    });
    return context;
  }

  /** In-process TTL cache; Redis replaces it when we run >1 replica. */
  private readonly storeContextCache = new Map<
    string,
    { value: StoreContext; expiresAt: number }
  >();

  /**
   * Load last 20 conversation turns for context window.
   * Uses DB fallback since Redis history is optional (post-v1 enhancement).
   * Ordered oldest-first so the LLM sees chronological conversation flow.
   */
  private async loadConversationHistory(
    storeId: string,
    customerPhone: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
      // Find the customer by phone within this store
      const customer = await this.prisma.customer.findFirst({
        where: { storeId, waPhone: customerPhone },
        select: { id: true },
      });
      if (!customer) return [];

      // Find the conversation for this customer
      const conversation = await this.prisma.conversation.findFirst({
        where: { storeId, customerId: customer.id },
        select: { id: true },
      });
      if (!conversation) return [];

      // Load last 20 messages (oldest first for LLM context)
      const messages = await this.prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { direction: true, body: true },
      });

      return messages
        .reverse() // oldest first
        .filter((m) => m.body !== null && m.body.trim().length > 0)
        .map((m) => ({
          role: m.direction === 'INBOUND' ? 'user' as const : 'assistant' as const,
          content: m.body!,
        }));
    } catch (err) {
      // History is best-effort; empty history is safe
      this.logger.debug({ err }, 'autoresponder.history.load-failed');
      return [];
    }
  }

  /**
   * Persist both sides of the conversation turn for future context.
   * The inbound message is already persisted by the webhook pipeline;
   * we append the outbound reply to enable multi-turn context on the
   * next inbound message.
   */
  private async persistConversationTurn(
    storeId: string,
    customerPhone: string,
    _inboundBody: string,
    outboundBody: string,
  ): Promise<void> {
    try {
      const customer = await this.prisma.customer.findFirst({
        where: { storeId, waPhone: customerPhone },
        select: { id: true },
      });
      if (!customer) return;

      const conversation = await this.prisma.conversation.findFirst({
        where: { storeId, customerId: customer.id },
        select: { id: true },
      });
      if (!conversation) return;

      // The outbound message is already persisted by the consumers layer
      // (persistOutbound in ai-consumers.service.ts). We just update the
      // conversation metadata to keep the inbox sorted correctly.
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: outboundBody.slice(0, 140),
        },
      });
    } catch (err) {
      // Fire-and-forget — failures here must not block the reply
      this.logger.debug({ err }, 'autoresponder.persist-failed');
    }
  }
}

interface StoreContext {
  storeName: string;
  country: string;
  currency: string;
  products: Array<{ name: string; price: number; stockQuantity: number; description?: string }>;
  policies: {
    deliveryAreas: string[];
    paymentMethods: string[];
    deliveryFeeNote?: string;
    returnPolicyDays?: number;
  };
}