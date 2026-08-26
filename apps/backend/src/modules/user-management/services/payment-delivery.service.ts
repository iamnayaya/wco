import type { MerchantDeliveryProvider, PaymentMethod } from '@prisma/client';
import { ConflictError, NotFoundError } from '@wco/shared';
import type { z } from 'zod';

import { prisma } from '../../../lib/prisma.js';
import { sealSecret, openSecret } from '../../../services/totp.service.js';
import type { deliveryProviderLinkSchema, deliveryProviderUpdateSchema, paymentMethodCreateSchema, paymentMethodUpdateSchema } from '../user-management.dto.js';

import { sha256Hex } from './user.service.js';

type PmCreate = z.infer<typeof paymentMethodCreateSchema>;
type PmUpdate = z.infer<typeof paymentMethodUpdateSchema>;
type DeliveryLink = z.infer<typeof deliveryProviderLinkSchema>;
type DeliveryUpdate = z.infer<typeof deliveryProviderUpdateSchema>;

/**
 * Payout methods & carrier links. Account numbers/credentials are sealed
 * (AES-256-GCM) before they touch the database; only last4 + a lookup hash
 * are stored in plaintext-adjacent form for dedupe/display.
 */

function last4(accountNumber: string): string {
  return accountNumber.slice(-4);
}

export class PaymentMethodService {
  private async requireUser(userId: string): Promise<{ id: string; merchantId: string; status: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found');
    return user;
  }

  async createPaymentMethod(userId: string, data: PmCreate): Promise<PaymentMethod> {
    const user = await this.requireUser(userId);
    const hash = sha256Hex(`${data.bankCode ?? ''}:${data.accountNumber}`);
    const dupe = await prisma.paymentMethod.findFirst({
      where: { merchantId: user.merchantId, accountNumberHash: hash },
    });
    if (dupe) throw new ConflictError('Payment method already exists');

    if (data.isDefault) {
      await prisma.paymentMethod.updateMany({ where: { merchantId: user.merchantId, isDefault: true }, data: { isDefault: false } });
    }
    return prisma.paymentMethod.create({
      data: {
        merchantId: user.merchantId,
        type: data.type,
        providerName: data.providerName,
        accountName: data.accountName,
        accountNumberEnc: sealSecret(data.accountNumber),
        accountNumberLast4: last4(data.accountNumber),
        accountNumberHash: hash,
        bankCode: data.bankCode,
        isDefault: data.isDefault,
      },
    });
  }

  async getPaymentMethodsByUserId(userId: string): Promise<PaymentMethod[]> {
    const user = await this.requireUser(userId);
    return prisma.paymentMethod.findMany({ where: { merchantId: user.merchantId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }

  async updatePaymentMethod(userId: string, methodId: string, data: PmUpdate): Promise<PaymentMethod> {
    const user = await this.requireUser(userId);
    await this.ownMethod(user.merchantId, methodId);
    if (data.isDefault) {
      await prisma.paymentMethod.updateMany({ where: { merchantId: user.merchantId, isDefault: true }, data: { isDefault: false } });
    }
    return prisma.paymentMethod.update({ where: { id: methodId }, data });
  }

  async deletePaymentMethod(userId: string, methodId: string): Promise<void> {
    const user = await this.requireUser(userId);
    await this.ownMethod(user.merchantId, methodId);
    await prisma.paymentMethod.delete({ where: { id: methodId } });
  }

  private async ownMethod(merchantId: string, methodId: string): Promise<void> {
    const rows = await prisma.paymentMethod.findMany({ where: { id: methodId, merchantId }, take: 1 });
    if (!rows[0]) throw new NotFoundError('Payment method not found');
  }

  /** Verification flow helper - reveals the number only to PSP integrations. */
  async revealAccountNumber(methodId: string): Promise<string> {
    const rows = await prisma.paymentMethod.findMany({ where: { id: methodId }, take: 1 });
    const enc = rows[0]?.accountNumberEnc;
    if (!enc) throw new NotFoundError('Payment method not found');
    return openSecret(enc);
  }
}

export class DeliveryProviderService {
  private async requireUser(userId: string): Promise<{ id: string; merchantId: string; status: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found');
    return user;
  }

  async createDeliveryProvider(userId: string, data: DeliveryLink): Promise<MerchantDeliveryProvider> {
    const user = await this.requireUser(userId);
    const catalog = await prisma.deliveryProvider.findMany({ where: { code: data.providerCode, isActive: true }, take: 1 });
    if (!catalog[0]) throw new NotFoundError(`Delivery provider ${data.providerCode} not available`);

    const existing = await prisma.merchantDeliveryProvider.findFirst({
      where: { merchantId: user.merchantId, providerCode: data.providerCode },
    });
    if (existing) throw new ConflictError('Provider already linked');

    if (data.isDefault) {
      await prisma.merchantDeliveryProvider.updateMany({ where: { merchantId: user.merchantId, isDefault: true }, data: { isDefault: false } });
    }
    return prisma.merchantDeliveryProvider.create({
      data: {
        merchantId: user.merchantId,
        providerCode: data.providerCode,
        accountRef: data.accountRef,
        credentialsEnc: data.credentials ? Buffer.from(sealSecret(data.credentials)) : null,
        isDefault: data.isDefault,
      },
    });
  }

  async getDeliveryProvidersByUserId(userId: string): Promise<MerchantDeliveryProvider[]> {
    const user = await this.requireUser(userId);
    return prisma.merchantDeliveryProvider.findMany({
      where: { merchantId: user.merchantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateDeliveryProvider(userId: string, linkId: string, data: DeliveryUpdate): Promise<MerchantDeliveryProvider> {
    const user = await this.requireUser(userId);
    await this.ownLink(user.merchantId, linkId);
    if (data.isDefault) {
      await prisma.merchantDeliveryProvider.updateMany({ where: { merchantId: user.merchantId, isDefault: true }, data: { isDefault: false } });
    }
    return prisma.merchantDeliveryProvider.update({
      where: { id: linkId },
      data: {
        ...(data.accountRef !== undefined ? { accountRef: data.accountRef } : {}),
        ...(data.credentials !== undefined ? { credentialsEnc: Buffer.from(sealSecret(data.credentials)) } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async deleteDeliveryProvider(userId: string, linkId: string): Promise<void> {
    const user = await this.requireUser(userId);
    await this.ownLink(user.merchantId, linkId);
    await prisma.merchantDeliveryProvider.delete({ where: { id: linkId } });
  }

  private async ownLink(merchantId: string, linkId: string): Promise<void> {
    const rows = await prisma.merchantDeliveryProvider.findMany({ where: { id: linkId, merchantId }, take: 1 });
    if (!rows[0]) throw new NotFoundError('Delivery provider link not found');
  }
}

export const paymentMethodService = new PaymentMethodService();
export const deliveryProviderService = new DeliveryProviderService();
