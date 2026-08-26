import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { pricingController } from './pricing.controller.js';
import { listSuggestionsQuerySchema, idParams } from './pricing.dto.js';

/** Pricing routes - AI price suggestions review/apply. */
export const pricingRouter: Router = Router();
pricingRouter.use(authenticate(), tenantScope());

pricingRouter.get(
  '/suggestions',
  validate({ query: listSuggestionsQuerySchema }),
  asyncHandler(pricingController.listSuggestions),
);

pricingRouter.post(
  '/suggestions/:id/apply',
  requirePermission('product:write'),
  validate({ params: idParams }),
  asyncHandler(pricingController.apply),
);

pricingRouter.post(
  '/suggestions/:id/dismiss',
  requirePermission('product:write'),
  validate({ params: idParams }),
  asyncHandler(pricingController.dismiss),
);
