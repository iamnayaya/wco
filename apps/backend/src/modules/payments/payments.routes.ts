import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { idempotency } from '../../middleware/idempotency.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { paymentsController } from './payments.controller.js';
import {
  initializePaymentSchema,
  refundSchema,
  listPaymentsQuerySchema,
  listPaymentsOffsetSchema,
  searchPaymentsSchema,
  exportPaymentsSchema,
  sendPaymentSchema,
  generatePaymentLinkSchema,
  paymentStatsSchema,
  listCommissionsQuerySchema,
  listFeesQuerySchema,
  fraudAnalyzeSchema,
  flaggedPaymentsQuerySchema,
  idParams,
  paymentIdParams,
} from './payments.dto.js';

/**
 * Payment routes.
 *
 * Mount order matters: literal segments (/providers, /stats, /search, /export)
 * before parameterized (/:id). Initialize is idempotency-guarded.
 */
export const paymentsRouter: Router = Router();
paymentsRouter.use(authenticate(), tenantScope());

// --- providers -------------------------------------------------------------

paymentsRouter.get('/providers', asyncHandler(paymentsController.listProviders));

// --- stats (literal before /:id) -------------------------------------------

paymentsRouter.get(
  '/stats',
  validate({ query: paymentStatsSchema }),
  asyncHandler(paymentsController.stats),
);

// --- search (literal before /:id) ------------------------------------------

paymentsRouter.get(
  '/search',
  validate({ query: searchPaymentsSchema }),
  asyncHandler(paymentsController.search),
);

// --- export (literal before /:id) ------------------------------------------

paymentsRouter.get(
  '/export',
  requirePermission('billing:manage'),
  validate({ query: exportPaymentsSchema }),
  asyncHandler(paymentsController.exportPayments),
);

// --- list (offset-based with filters) --------------------------------------

paymentsRouter.get(
  '/',
  validate({ query: listPaymentsOffsetSchema }),
  asyncHandler(paymentsController.listOffset),
);

// --- initialize checkout ---------------------------------------------------

paymentsRouter.post(
  '/initialize',
  requirePermission('order:write'),
  idempotency(),
  validate({ body: initializePaymentSchema }),
  asyncHandler(paymentsController.initialize),
);

// --- send payment (direct, no order) ---------------------------------------

paymentsRouter.post(
  '/send',
  requirePermission('order:write'),
  idempotency(),
  validate({ body: sendPaymentSchema }),
  asyncHandler(paymentsController.send),
);

// --- generate payment link -------------------------------------------------

paymentsRouter.post(
  '/generate-link',
  requirePermission('order:write'),
  idempotency(),
  validate({ body: generatePaymentLinkSchema }),
  asyncHandler(paymentsController.generateLink),
);

// --- get by order ID (literal before /:id) ---------------------------------

paymentsRouter.get(
  '/order/:id',
  validate({ params: idParams }),
  asyncHandler(paymentsController.getByOrderId),
);

// --- get by ID -------------------------------------------------------------

paymentsRouter.get(
  '/:id',
  validate({ params: idParams }),
  asyncHandler(paymentsController.getById),
);

// --- manual verify ---------------------------------------------------------

paymentsRouter.post(
  '/:id/verify',
  validate({ params: idParams }),
  asyncHandler(paymentsController.verify),
);

// --- refund ----------------------------------------------------------------

paymentsRouter.post(
  '/:id/refund',
  requirePermission('billing:manage'),
  validate({ params: idParams, body: refundSchema }),
  asyncHandler(paymentsController.refund),
);

// --- list refunds for a payment --------------------------------------------

paymentsRouter.get(
  '/:id/refunds',
  validate({ params: idParams, query: listPaymentsOffsetSchema }),
  asyncHandler(paymentsController.listRefunds),
);

// --- payment transactions (audit log) --------------------------------------

paymentsRouter.get(
  '/:id/transactions',
  validate({ params: idParams }),
  asyncHandler(paymentsController.listTransactions),
);

// --- commissions for a payment (literal before /:id) -----------------------

paymentsRouter.get(
  '/:id/commissions',
  validate({ params: idParams }),
  asyncHandler(paymentsController.listCommissionsByPayment),
);

// --- fees for a payment (literal before /:id) ------------------------------

paymentsRouter.get(
  '/:id/fees',
  validate({ params: idParams }),
  asyncHandler(paymentsController.listFeesByPayment),
);

// --- commissions list (literal before /:id) ---------------------------------

paymentsRouter.get(
  '/commissions',
  requirePermission('billing:manage'),
  validate({ query: listCommissionsQuerySchema }),
  asyncHandler(paymentsController.listCommissions),
);

paymentsRouter.get(
  '/commissions/summary',
  requirePermission('billing:manage'),
  asyncHandler(paymentsController.commissionSummary),
);

// --- fees list (literal before /:id) ----------------------------------------

paymentsRouter.get(
  '/fees',
  requirePermission('billing:manage'),
  validate({ query: listFeesQuerySchema }),
  asyncHandler(paymentsController.listFees),
);

paymentsRouter.get(
  '/fees/summary',
  requirePermission('billing:manage'),
  asyncHandler(paymentsController.feeSummary),
);

// --- fraud detection (literal before /:id) ----------------------------------

paymentsRouter.get(
  '/fraud/flagged',
  requirePermission('billing:manage'),
  validate({ query: flaggedPaymentsQuerySchema }),
  asyncHandler(paymentsController.flaggedPayments),
);

paymentsRouter.post(
  '/fraud/analyze',
  requirePermission('billing:manage'),
  validate({ body: fraudAnalyzeSchema }),
  asyncHandler(paymentsController.analyzeFraud),
);
