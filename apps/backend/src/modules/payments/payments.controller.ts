import { PaymentFailedError } from '@wco/shared';
import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { paymentsService } from '../../services/payments.service.js';
import { paginationMeta } from '../../utils/offset-pagination.js';
import { sendSuccess } from '../../utils/api-response.js';

import { commissionsService } from './services/commissions.service.js';
import { feesService } from './services/fees.service.js';
import { fraudDetectionService } from './services/fraud-detection.service.js';

/**
 * Payments controller — checkout init, list (cursor + offset), search,
 * export, stats, direct send, link generation, verify, refund,
 * commissions, fees, and fraud detection.
 */
export const paymentsController = {
  // --- providers ------------------------------------------------------------

  async listProviders(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, { providers: paymentsService.listConfigured() });
  },

  // --- list (cursor-based, original) ----------------------------------------

  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as { limit: number; cursor?: string };
    sendSuccess(res, await paymentsService.list(getStoreId(req), query.limit, query.cursor));
  },

  // --- list (offset-based, with filters) -------------------------------------

  async listOffset(req: Request, res: Response): Promise<void> {
    const q = req.query as Record<string, unknown>;
    const storeId = getStoreId(req);

    const where = paymentsService.buildWhereClause(storeId, q);
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      paymentsService.listOffset(storeId, where, page, pageSize, String(q.sortBy || 'createdAt'), String(q.sortOrder || 'desc')),
      paymentsService.count(where),
    ]);

    sendSuccess(res, { items, meta: paginationMeta(page, pageSize, total) });
  },

  // --- search ---------------------------------------------------------------

  async search(req: Request, res: Response): Promise<void> {
    const { q, page, pageSize } = req.query as unknown as { q: string; page: number; pageSize: number };
    const storeId = getStoreId(req);

    const [items, total] = await Promise.all([
      paymentsService.search(storeId, q, page, pageSize),
      paymentsService.searchCount(storeId, q),
    ]);

    sendSuccess(res, { items, meta: paginationMeta(page, pageSize, total) });
  },

  // --- export ---------------------------------------------------------------

  async exportPayments(req: Request, res: Response): Promise<void> {
    const q = req.query as Record<string, unknown>;
    const storeId = getStoreId(req);
    const format = String(q.format || 'csv');

    const where = paymentsService.buildWhereClause(storeId, q);
    const rows = await paymentsService.exportData(where, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payments-${Date.now()}.csv"`);
      res.send(rows);
      return;
    }

    sendSuccess(res, { items: rows, total: rows.length });
  },

  // --- stats ----------------------------------------------------------------

  async stats(req: Request, res: Response): Promise<void> {
    const q = req.query as Record<string, unknown>;
    const storeId = getStoreId(req);
    sendSuccess(res, await paymentsService.stats(storeId, q.from as Date | undefined, q.to as Date | undefined, String(q.groupBy || 'day')));
  },

  // --- initialize checkout --------------------------------------------------

  async initialize(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);

    // Run fraud detection before initializing payment
    const fraudResult = await fraudDetectionService.analyze(storeId, {
      amount: req.body.amount ?? 0,
      currency: req.body.currency ?? 'NGN',
      provider: req.body.provider,
      customerPhone: req.body.customerPhone,
      metadata: req.body.metadata,
    });

    if (fraudResult.blocked) {
      throw new PaymentFailedError(`Payment blocked by fraud detection: ${fraudResult.reasons.join(', ')}`);
    }

    const { payment, checkoutUrl } = await paymentsService.initialize(
      storeId,
      req.body.orderId,
      req.body.provider,
    );

    // Attach fraud score to payment metadata if flagged
    const response: Record<string, unknown> = { payment, checkoutUrl };
    if (fraudResult.flagged) {
      response.fraudWarning = { score: fraudResult.score, reasons: fraudResult.reasons };
    }

    sendSuccess(res, response, undefined, 201);
  },

  // --- send payment (direct, no order) --------------------------------------

  async send(req: Request, res: Response): Promise<void> {
    const { payment, checkoutUrl } = await paymentsService.sendDirect(
      getStoreId(req),
      req.body,
    );
    sendSuccess(res, { payment, checkoutUrl }, undefined, 201);
  },

  // --- generate payment link ------------------------------------------------

  async generateLink(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const { payment, checkoutUrl } = await paymentsService.generatePaymentLink(storeId, req.body);
    sendSuccess(res, { payment, checkoutUrl }, undefined, 201);
  },

  // --- get by ID ------------------------------------------------------------

  async getById(req: Request, res: Response): Promise<void> {
    const payment = await paymentsService.getById(getStoreId(req), req.params.id);
    sendSuccess(res, payment);
  },

  // --- get by order ID ------------------------------------------------------

  async getByOrderId(req: Request, res: Response): Promise<void> {
    const payment = await paymentsService.getByOrderId(getStoreId(req), req.params.id);
    sendSuccess(res, payment);
  },

  // --- manual verify --------------------------------------------------------

  async verify(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentsService.verify(getStoreId(req), req.params.id));
  },

  // --- refund ---------------------------------------------------------------

  async refund(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentsService.refund(getStoreId(req), req.params.id, req.body.amount, req.body.reason));
  },

  // --- list refunds for a payment -------------------------------------------

  async listRefunds(req: Request, res: Response): Promise<void> {
    const q = req.query as Record<string, unknown>;
    const storeId = getStoreId(req);
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      paymentsService.listRefunds(storeId, req.params.id, page, pageSize, String(q.sortBy || 'createdAt'), String(q.sortOrder || 'desc')),
      paymentsService.countRefunds(storeId, req.params.id),
    ]);

    sendSuccess(res, { items, meta: paginationMeta(page, pageSize, total) });
  },

  // --- payment transactions (audit log) -------------------------------------

  async listTransactions(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const page = Number(req.query.page) || 1;
    const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      paymentsService.listTransactions(storeId, req.params.id, page, pageSize),
      paymentsService.countTransactions(storeId, req.params.id),
    ]);

    sendSuccess(res, { items, meta: paginationMeta(page, pageSize, total) });
  },

  // --- commissions ----------------------------------------------------------

  async listCommissions(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      commissionsService.listByStore(storeId, page, pageSize, {
        status: q.status as string | undefined,
        from: q.from ? new Date(String(q.from)) : undefined,
        to: q.to ? new Date(String(q.to)) : undefined,
      }),
      commissionsService.countByStore(storeId, { status: q.status as string | undefined }),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async commissionSummary(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await commissionsService.getStoreSummary(getStoreId(req)));
  },

  async listCommissionsByPayment(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await commissionsService.getByPaymentId(req.params.id));
  },

  // --- fees -----------------------------------------------------------------

  async listFees(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      feesService.listByStore(storeId, page, pageSize, {
        type: q.type as string | undefined,
        status: q.status as string | undefined,
      }),
      feesService.countByStore(storeId, {
        type: q.type as string | undefined,
        status: q.status as string | undefined,
      }),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async feeSummary(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await feesService.getStoreSummary(getStoreId(req)));
  },

  async listFeesByPayment(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await feesService.getByPaymentId(req.params.id));
  },

  // --- fraud detection ------------------------------------------------------

  async flaggedPayments(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const page = Number(req.query.page) || 1;
    const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);

    const items = await fraudDetectionService.getFlaggedPayments(storeId, page, pageSize);
    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, items.length) });
  },

  async analyzeFraud(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const result = await fraudDetectionService.analyze(storeId, req.body);
    sendSuccess(res, result);
  },
} as const;
