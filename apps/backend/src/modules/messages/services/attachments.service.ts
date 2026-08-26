import type { MessageAttachment } from '@prisma/client';
import { ForbiddenError, NotFoundError, ValidationError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';
import { uploadsService } from '../../../services/uploads.service.js';

/**
 * Message media: WhatsApp-grade whitelist, 10 MB ceiling, S3-backed storage
 * through the shared uploads service. Attachments belong to a message; the
 * upload endpoint accepts an optional messageId so clients can attach after
 * send as well.
 */

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'audio/ogg',
  'audio/mpeg',
  'video/mp4',
]);

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface UploadInput {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly originalname: string;
}

export class AttachmentsService {
  assertAllowed(file: UploadInput): void {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new ValidationError(`Unsupported file type ${file.mimetype}`, {
        allowed: [...ALLOWED_MIME_TYPES],
      });
    }
    if (file.buffer.length > MAX_ATTACHMENT_BYTES) {
      throw new ValidationError('Attachment exceeds the 10MB limit');
    }
  }

  async create(
    storeId: string,
    input: UploadInput,
    opts: { threadId?: string; messageId?: string } = {},
  ): Promise<MessageAttachment | { url: string; fileName: string; mimeType: string; sizeBytes: number }> {
    this.assertAllowed(input);

    const targetMessageId = opts.messageId;
    if (targetMessageId !== undefined) {
      const message = await prisma.message.findUnique({ where: { id: targetMessageId } });
      if (!message) throw new NotFoundError('Message');
      const thread = await prisma.conversation.findFirst({
        where: { id: message.conversationId, storeId },
        select: { id: true },
      });
      if (!thread) throw new ForbiddenError('Message belongs to another store');
    } else if (opts.threadId !== undefined) {
      const thread = await prisma.conversation.findFirst({
        where: { id: opts.threadId, storeId },
        select: { id: true },
      });
      if (!thread) throw new NotFoundError('Thread');
    }

    const stored = await uploadsService.upload(storeId, 'messages', {
      buffer: input.buffer,
      mimetype: input.mimetype,
      originalname: input.originalname,
    });

    // Without a message to hang on we return the URL only - the row is created
    // when the message itself is sent (mediaUrl points at the same object).
    if (targetMessageId === undefined) {
      return { url: stored.url, fileName: input.originalname, mimeType: input.mimetype, sizeBytes: input.buffer.length };
    }
    return prisma.messageAttachment.create({
      data: {
        messageId: targetMessageId,
        fileName: input.originalname,
        mimeType: input.mimetype,
        sizeBytes: input.buffer.length,
        url: stored.url,
      },
    });
  }

  async listForMessage(storeId: string, messageId: string): Promise<MessageAttachment[]> {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundError('Message');
    const thread = await prisma.conversation.findFirst({
      where: { id: message.conversationId, storeId },
      select: { id: true },
    });
    if (!thread) throw new NotFoundError('Message');
    return prisma.messageAttachment.findMany({ where: { messageId }, orderBy: { createdAt: 'asc' } });
  }
}

export const attachmentsService = new AttachmentsService();
