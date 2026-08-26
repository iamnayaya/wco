import type { Request, Response } from 'express';

import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../utils/api-response.js';

/**
 * Admin controller - platform-wide aggregate reads for the internal ops
 * dashboard (apps/admin-dashboard). Aggregate-only by design: no endpoint
 * returns another merchant's raw business records.
 */
export const adminController = {
  async platformStats(_req: Request, res: Response): Promise<void> {
    const since24h = new Date(Date.now() - 24 * 3_600_000);
    const [merchants, stores, users, orders24h, gmvAllTime, messages24h] = await Promise.all([
      prisma.merchant.count(),
      prisma.store.count(),
      prisma.user.count(),
      prisma.order.count({ where: { createdAt: { gte: since24h } } }),
      prisma.order.aggregate({ where: { status: 'PAID' }, _sum: { total: true } }),
      prisma.message.count({ where: { createdAt: { gte: since24h } } }),
    ]);

    sendSuccess(res, {
      merchants,
      stores,
      users,
      ordersLast24h: orders24h,
      paidGmvTotal: Number(gmvAllTime._sum.total ?? 0),
      messagesLast24h: messages24h,
      generatedAt: new Date().toISOString(),
    });
  },

  async listMerchants(req: Request, res: Response): Promise<void> {
    const limit = Number(req.query.limit ?? 25);
    const merchants = await prisma.merchant.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        companyName: true,
        email: true,
        country: true,
        plan: true,
        createdAt: true,
        _count: { select: { users: true, stores: true } },
      },
    });
    sendSuccess(res, merchants);
  },
} as const;
