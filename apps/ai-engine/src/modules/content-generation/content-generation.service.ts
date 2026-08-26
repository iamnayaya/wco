import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { ClaudeService } from '../../services/claude/claude.service';
import { OpenAIService } from '../../services/openai/openai.service';

/**
 * ContentGenerationService — merchant-facing copy generation.
 * Product descriptions, promo broadcast drafts, status/WhatsApp catalog
 * blurbs — tuned for informal-trade tone: short, warm, emoji-light,
 * Pidgin-friendly on request.
 */
@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
    private readonly openai: OpenAIService,
  ) {}

  async generateProductDescription(
    storeId: string,
    productId: string,
    opts: { tone?: 'friendly' | 'professional' | 'pidgin'; maxLength?: number } = {},
  ): Promise<{ description: string }> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
      select: { name: true, price: true, attributes: true, description: true },
    });
    if (!product) throw new Error('Product not found');

    const toneInstruction = {
      friendly: 'Warm and simple English, like a helpful shopkeeper.',
      professional: 'Clear and concise retail copy.',
      pidgin: 'Nigerian Pidgin English, friendly and respectful.',
    }[opts.tone ?? 'friendly'];

    const prompt =
      `Write a WhatsApp product description for "${product.name}" priced at ${Number(product.price)}. ` +
      `Attributes: ${JSON.stringify(product.attributes ?? {})}. ` +
      `${toneInstruction} Max ${opts.maxLength ?? 320} characters. Include a clear call-to-action to reply "BUY". No preamble.`;

    const text = await this.completeWithFallback(prompt, 400);
    return { description: text.trim().slice(0, (opts.maxLength ?? 320) + 80) };
  }

  async generatePromoBroadcast(
    storeId: string,
    input: { occasion: string; discountPct?: number; audience: string },
  ): Promise<{ message: string }> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId },
      select: { name: true, currency: true },
    });

    const prompt =
      `Write a short WhatsApp broadcast promo for store "${store?.name}". Occasion: ${input.occasion}. ` +
      `${input.discountPct ? `${input.discountPct}% discount. ` : ''}Audience: ${input.audience}. ` +
      `Max 300 characters, one emoji max, include reply CTA. No preamble.`;

    return { message: (await this.completeWithFallback(prompt, 350)).trim() };
  }

  private async completeWithFallback(prompt: string, maxTokens: number): Promise<string> {
    try {
      return await this.claude.complete({ prompt, maxTokens });
    } catch {
      // fall through
    }
    try {
      return await this.openai.complete({ prompt, maxTokens });
    } catch (error) {
      this.logger.error({ err: error }, 'content-generation.all-providers-down');
      throw new Error('AI providers unavailable — try again shortly');
    }
  }
}
