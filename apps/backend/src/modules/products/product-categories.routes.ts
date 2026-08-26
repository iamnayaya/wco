import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { productCategoriesController } from './catalog.controller.js';
import {
  categoryV2BodySchema,
  categoryV2UpdateSchema,
  idParams,
} from './products.dto.js';

/** Category taxonomy (v2) - mounted at /product-categories. */
export const productCategoriesRouter: Router = Router();
productCategoriesRouter.use(authenticate(), tenantScope());

productCategoriesRouter.get('/', asyncHandler(productCategoriesController.list));

productCategoriesRouter.post(
  '/',
  requirePermission('product:write'),
  validate({ body: categoryV2BodySchema }),
  asyncHandler(productCategoriesController.create),
);

productCategoriesRouter.get('/:id', validate({ params: idParams }), asyncHandler(productCategoriesController.get));

productCategoriesRouter.put(
  '/:id',
  requirePermission('product:write'),
  validate({ params: idParams, body: categoryV2UpdateSchema }),
  asyncHandler(productCategoriesController.update),
);

productCategoriesRouter.delete(
  '/:id',
  requirePermission('product:write'),
  validate({ params: idParams }),
  asyncHandler(productCategoriesController.remove),
);
