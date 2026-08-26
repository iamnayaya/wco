import type { AiIntent } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

/**
 * Store-taught intents (the "custom intents" catalog). They outrank built-in
 * lexicons during classification and are matched by keyword with priority as
 * the tie-breaker - no embeddings, fully explainable.
 */

export interface CreateIntentInput {
  readonly name: string;
  readonly keywords: readonly string[];
  readonly sampleUtterances?: string;
  readonly cannedResponse?: string;
  readonly priority?: number;
  readonly isActive: boolean;
}

const MAX_INTENTS_PER_STORE = 50;

export class AiIntentsService {
  async list(storeId: string): Promise<AiIntent[]> {
    return prisma.aiIntent.findMany({
      where: { storeId },
      orderBy: [{ isActive: 'desc' }, { priority: 'desc' }, { name: 'asc' }],
    });
  }

  async create(storeId: string, input: CreateIntentInput): Promise<AiIntent> {
    const count = await prisma.aiIntent.count({ where: { storeId } });
    if (count >= MAX_INTENTS_PER_STORE) {
      throw new ValidationError(`Store already teaches ${MAX_INTENTS_PER_STORE} intents`);
    }
    try {
      return await prisma.aiIntent.create({
        data: {
          storeId,
          name: input.name,
          keywords: [...input.keywords],
          sampleUtterances: input.sampleUtterances !== undefined ? [...input.sampleUtterances] : [],
          cannedResponse: input.cannedResponse ?? null,
          priority: input.priority ?? 10,
          isActive: input.isActive,
        },
      });
    } catch (err) {
      throw mapUniqueViolation(err, input.name);
    }
  }

  async update(storeId: string, intentId: string, data: Record<string, unknown>): Promise<AiIntent> {
    const intent = await this.get(storeId, intentId);
    try {
      return await prisma.aiIntent.update({ where: { id: intent.id }, data });
    } catch (err) {
      throw mapUniqueViolation(err, String(data.name ?? intent.name));
    }
  }

  async remove(storeId: string, intentId: string): Promise<void> {
    const intent = await this.get(storeId, intentId);
    await prisma.aiIntent.delete({ where: { id: intent.id } });
  }

  private async get(storeId: string, intentId: string): Promise<AiIntent> {
    const intent = await prisma.aiIntent.findFirst({ where: { id: intentId, storeId } });
    if (!intent) throw new NotFoundError('Intent');
    return intent;
  }
}

function mapUniqueViolation(err: unknown, name: string): Error {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  ) {
    return new ConflictError(`Intent "${name}" already exists for this store`);
  }
  return err instanceof Error ? err : new ValidationError('Intent write failed');
}

export const aiIntentsService = new AiIntentsService();
