import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { getStoreId, requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { createTagSchema, idParams, tagCustomerParams, updateTagSchema } from './customers.dto.js';
import { customerTagService } from './services/crm.service.js';

/** Tag catalog + assignment. Assignment syncs customers.tags (fast filter). */
export const customerTagsRouter: Router = Router();
customerTagsRouter.use(authenticate(), tenantScope());

customerTagsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await customerTagService.listTags(getStoreId(req)));
  }),
);

customerTagsRouter.post(
  '/',
  requirePermission('store:write'),
  validate({ body: createTagSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await customerTagService.createTag(getStoreId(req), req.body), undefined, 201);
  }),
);

customerTagsRouter.get(
  '/:id',
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await customerTagService.getTagById(getStoreId(req), req.params.id));
  }),
);

customerTagsRouter.put(
  '/:id',
  requirePermission('store:write'),
  validate({ params: idParams, body: updateTagSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await customerTagService.updateTag(getStoreId(req), req.params.id, req.body));
  }),
);

customerTagsRouter.delete(
  '/:id',
  requirePermission('store:write'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await customerTagService.deleteTag(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  }),
);

customerTagsRouter.post(
  '/:id/customers/:customerId',
  requirePermission('store:write'),
  validate({ params: tagCustomerParams }),
  asyncHandler(async (req, res) => {
    const customer = await customerTagService.assignToCustomer(
      getStoreId(req),
      req.params.id,
      req.params.customerId,
    );
    sendSuccess(res, customer, undefined, 201);
  }),
);

customerTagsRouter.delete(
  '/:id/customers/:customerId',
  requirePermission('store:write'),
  validate({ params: tagCustomerParams }),
  asyncHandler(async (req, res) => {
    const customer = await customerTagService.removeFromCustomer(
      getStoreId(req),
      req.params.id,
      req.params.customerId,
    );
    sendSuccess(res, customer);
  }),
);
