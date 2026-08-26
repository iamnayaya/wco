import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { deliveriesController } from './logistics.controller.js';
import { quoteSchema, quoteQuerySchema, orderIdParams, idParams } from './logistics.dto.js';

/** Logistics routes - carrier quotes, booking, tracking status. */
export const deliveriesRouter: Router = Router();
deliveriesRouter.use(authenticate(), tenantScope());

deliveriesRouter.get('/carriers', asyncHandler(deliveriesController.listCarriers));

deliveriesRouter.post(
  '/quote/:orderId',
  requirePermission('order:write'),
  validate({ params: orderIdParams, body: quoteSchema, query: quoteQuerySchema }),
  asyncHandler(deliveriesController.quote),
);

deliveriesRouter.post(
  '/:id/book',
  requirePermission('order:write'),
  validate({ params: idParams }),
  asyncHandler(deliveriesController.book),
);

deliveriesRouter.get(
  '/order/:orderId',
  validate({ params: orderIdParams }),
  asyncHandler(deliveriesController.getByOrder),
);
