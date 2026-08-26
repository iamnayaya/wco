import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { ClaudeService } from '../../services/claude/claude.service';

/**
 * SentimentAnalysisService — classifies inbound customer messages.
 *
 * Used for:
 *  - Escalation triage (angry customers skip the bot queue)
 *  - Customer sentiment rollups in CRM (Customer.sentiment)
 *
 * Cheap classification: Haiku with JSON output, temperature 0.
 */
@Injectable()
export class SentimentAnalysisService {
  private readonly logger = new Logger(SentimentAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
  ) {}

  async analyze(storeId: string, conversationId: string, text: string): Promise<{
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    escalate: boolean;
  }> {
    const prompt =
      'Classify this WhatsApp customer message. Respond ONLY with JSON: ' +
      '{"sentiment":"POSITIVE|NEUTRAL|NEGATIVE","escalate":true|false}. ' +
      'Set escalate=true for anger, refund demands, threats to leave, or legal words.\n\n' +
      `Message: "${text.slice(0, 1000)}"`;

    let parsed: { sentiment?: string; escalate?: boolean };
    try {
      const raw = await this.claude.complete({ prompt, maxTokens: 64 });
      parsed = JSON.parse(raw) as { sentiment?: string; escalate?: boolean };
    } catch {
      // Never block the reply path on classifier failure
      return { sentiment: 'NEUTRAL', escalate: false };
    }

    const sentiment =
      parsed.sentiment === 'POSITIVE' || parsed.sentiment === 'NEGATIVE'
        ? parsed.sentiment
        : 'NEUTRAL';
    const escalate = Boolean(parsed.escalate) || sentiment === 'NEGATIVE';

    // Roll up to the customer record — CRM shows last-known sentiment
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, storeId },
      select: { customerId: true },
    });
    if (conversation) {
      await this.prisma.customer.update({
        where: { id: conversation.customerId },
        data: { sentiment },
      });
    }

    return { sentiment, escalate };
  }
}
