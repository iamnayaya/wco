import type { WhatsAppConnection } from '@prisma/client';
import { ConflictError, NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

/**
 * WhatsApp Business connection lifecycle (Meta Cloud API).
 *
 * connect   -> row CONNECTING + display metadata (seller completes Meta
 *              business verification out-of-band or via embedded signup).
 * verify    -> Meta phone_number_id (+ optional waba id) recorded; the store's
 *              routing fields are synced so the webhook can resolve inbound
 *              traffic to this store by phoneNumberId alone.
 * disconnect-> status DISCONNECTED; routing ids cleared so the number stops
 *              receiving auto-replies immediately.
 */

export class WhatsAppConnectionService {
  async connect(storeId: string, merchantId: string, input: { phone: string; displayName?: string }): Promise<WhatsAppConnection> {
    const existing = await prisma.whatsAppConnection.findFirst({
      where: { merchantId, storeId },
    });
    if (existing && existing.status === 'CONNECTED' && existing.phone === input.phone) {
      throw new ConflictError('This number is already connected');
    }

    const row =
      existing ??
      (await prisma.whatsAppConnection.create({
        data: {
          merchantId,
          storeId,
          phone: input.phone,
          status: 'CONNECTING',
        },
      }));

    const updated = await prisma.whatsAppConnection.update({
      where: { id: row.id },
      data: {
        storeId,
        status: 'CONNECTING',
        lastError: null,
        disconnectedAt: null,
        ...(existing ? {} : { qrSessionRef: `pair_${row.id.slice(-8)}` }),
      },
    });

    // Display name/number ride on the store record for the inbox header.
    await prisma.store.update({ where: { id: storeId }, data: { whatsappNumber: input.phone } });
    return updated;
  }

  async verify(
    storeId: string,
    merchantId: string,
    input: { phoneNumberId: string; wabaId?: string },
  ): Promise<WhatsAppConnection> {
    const row = await prisma.whatsAppConnection.findFirst({ where: { merchantId, storeId } });
    if (!row) throw new NotFoundError('WhatsApp connection');

    const clash = await prisma.whatsAppConnection.findUnique({ where: { phoneNumberId: input.phoneNumberId } });
    if (clash !== null && clash.id !== row.id) {
      throw new ConflictError('This WhatsApp number is already linked to another store');
    }

    const updated = await prisma.whatsAppConnection.update({
      where: { id: row.id },
      data: {
        status: 'CONNECTED',
        phoneNumberId: input.phoneNumberId,
        ...(input.wabaId !== undefined ? { wabaId: input.wabaId } : {}),
        connectedAt: new Date(),
        healthCheckedAt: new Date(),
        lastError: null,
      },
    });

    // Webhook routing depends on these two store columns staying in sync.
    await prisma.store.update({
      where: { id: storeId },
      data: { whatsappNameId: input.phoneNumberId },
    });
    return updated;
  }

  async disconnect(storeId: string, merchantId: string): Promise<WhatsAppConnection> {
    const row = await prisma.whatsAppConnection.findFirst({ where: { merchantId, storeId } });
    if (!row) throw new NotFoundError('WhatsApp connection');

    const updated = await prisma.whatsAppConnection.update({
      where: { id: row.id },
      data: {
        status: 'DISCONNECTED',
        disconnectedAt: new Date(),
        qrSessionRef: null,
      },
    });
    await prisma.store.update({ where: { id: storeId }, data: { whatsappNameId: null } });
    return updated;
  }

  async getConnection(storeId: string, merchantId: string): Promise<WhatsAppConnection | null> {
    return prisma.whatsAppConnection.findFirst({ where: { merchantId, storeId } });
  }

  async requireConnection(storeId: string, merchantId: string): Promise<WhatsAppConnection> {
    const row = await this.getConnection(storeId, merchantId);
    if (!row) throw new NotFoundError('WhatsApp connection - connect a number first');
    return row;
  }

  /** Liveness probe result used by GET /whatsapp/status. */
  async status(storeId: string): Promise<{
    readonly connected: boolean;
    readonly phoneNumberId: string | null;
    readonly lastError: string | null;
    readonly healthCheckedAt: Date | null;
  }> {
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      connected: connection?.status === 'CONNECTED',
      phoneNumberId: connection?.phoneNumberId ?? null,
      lastError: connection?.lastError ?? null,
      healthCheckedAt: connection?.healthCheckedAt ?? null,
    };
  }
}

export const whatsAppConnectionService = new WhatsAppConnectionService();
