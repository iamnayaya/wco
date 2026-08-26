import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { getStoreId, requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { createSegmentSchema, idParams, tagCustomerParams, updateSegmentSchema } from './customers.dto.js';
import { autoSegmentService, customerSegmentService } from './services/crm.service.js';

/**
 * Segment routes. POST /auto runs the AI segmentation engine for the active
 * store (idempotent; safe to call from cron + UI button).
 */
export const customerSegmentsRouter: Router = Router();
customerSegmentsRouter.use(authenticate(), tenantScope());

customerSegmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await customerSegmentService.listSegments(getStoreId(req)));
  }),
);

customerSegmentsRouter.post(
  '/',
  requirePermission('store:write'),
  validate({ body: createSegmentSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await customerSegmentService.createSegment(getStoreId(req), req.body), undefined, 201);
  }),
);

customerSegmentsRouter.post(
  '/auto',
  requirePermission('store:write'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await autoSegmentService.runForStore(getStoreId(req)));
  }),
);

customerSegmentsRouter.get(
  '/:id',
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await customerSegmentService.getSegmentById(getStoreId(req), req.params.id));
  }),
);

customerSegmentsRouter.put(
  '/:id',
  requirePermission('store:write'),
  validate({ params: idParams, body: updateSegmentSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await customerSegmentService.updateSegment(getStoreId(req), req.params.id, req.body));
  }),
);

customerSegmentsRouter.delete(
  '/:id',
  requirePermission('store:write'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await customerSegmentService.deleteSegment(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  }),
);

customerSegmentsRouter.post(
  '/:id/customers/:customerId',
  requirePermission('store:write'),
  validate({ params: tagCustomerParams }),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await customerSegmentService.addCustomer(getStoreId(req), req.params.id, req.params.customerId),
      undefined,
      201,
    );
  }),
);

customerSegmentsRouter.delete(
  '/:id/customers/:customerId',
  requirePermission('store:write'),
  validate({ params: tagCustomerParams }),
  asyncHandler(async (req, res) => {
    await customerSegmentService.removeCustomer(getStoreId(req), req.params.id, req.params.customerId);
    sendSuccess(res, { removed: true });
  }),
);
