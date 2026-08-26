import type { WhatsAppConnection } from '@prisma/client';
import { ConflictError, NotFoundError } from '@wco/shared';
import type { z } from 'zod';

import { prisma } from '../../../lib/prisma.js';
import { notificationService } from '../../../services/notification.service.js';
import type { waConnectionSchema, waConnectionUpdateSchema } from '../user-management.dto.js';

type WaCreate = z.infer<typeof waConnectionSchema>;
type WaUpdate = z.infer<typeof waConnectionUpdateSchema>;

/**
 * WhatsApp Business connection CRUD. Real pairing/handshake state transitions
 * live in the messaging integration; this service owns the merchant-facing
 * record + lifecycle bookkeeping (connectedAt/disconnectedAt).
 */
export class WhatsAppConnectionService {
  private async requireUser(userId: string): Promise<{ id: string; merchantId: string; status: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found');
    return user;
  }

  async createWhatsAppConnection(userId: string, data: WaCreate): Promise<WhatsAppConnection> {
    const user = await this.requireUser(userId);
    const existing = await prisma.whatsAppConnection.findMany({ where: { merchantId: user.merchantId }, take: 1 });
    if (existing[0]) throw new ConflictError('Merchant already has a WhatsApp connection');

    return prisma.whatsAppConnection.create({
      data: {
        merchantId: user.merchantId,
        storeId: data.storeId,
        phone: data.phone,
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        status: data.phoneNumberId ? 'CONNECTING' : 'DISCONNECTED',
      },
    });
  }

  async getWhatsAppConnectionByUserId(userId: string): Promise<WhatsAppConnection> {
    const user = await this.requireUser(userId);
    const rows = await prisma.whatsAppConnection.findMany({
      where: { merchantId: user.merchantId },
      orderBy: [{ createdAt: 'desc' }],
      take: 1,
    });
    if (!rows[0]) throw new NotFoundError('No WhatsApp connection');
    return rows[0];
  }

  async updateWhatsAppConnection(userId: string, data: WaUpdate): Promise<WhatsAppConnection> {
    const connection = await this.getWhatsAppConnectionByUserId(userId);
    const next: Record<string, unknown> = {};
    for (const key of ['phone', 'phoneNumberId', 'wabaId', 'storeId'] as const) {
      if (data[key] !== undefined) next[key] = data[key];
    }
    if ((next.phoneNumberId ?? connection.phoneNumberId) && !('status' in next)) {
      next.status = 'CONNECTING';
    }
    return prisma.whatsAppConnection.update({ where: { id: connection.id }, data: next });
  }

  async markConnected(id: string): Promise<void> {
    await prisma.whatsAppConnection.update({
      where: { id },
      data: { status: 'CONNECTED', connectedAt: new Date(), disconnectedAt: null, lastError: null },
    });
  }

  async markDisconnected(id: string, reason: string): Promise<void> {
    const conn = await prisma.whatsAppConnection.findUnique({ where: { id } });
    await prisma.whatsAppConnection.update({
      where: { id },
      data: { status: 'ERROR', disconnectedAt: new Date(), lastError: reason },
    });
    if (conn) void notificationService.sendEmail('wa-disconnected', conn.merchantId, { reason });
  }

  async deleteWhatsAppConnection(userId: string): Promise<void> {
    const connection = await this.getWhatsAppConnectionByUserId(userId);
    await prisma.whatsAppConnection.delete({ where: { id: connection.id } });
  }
}

export const whatsappConnectionService = new WhatsAppConnectionService();
