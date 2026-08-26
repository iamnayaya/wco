import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { campaignsController } from './campaigns.controller.js';
import { createCampaignSchema, idParams } from './campaigns.dto.js';

/** Marketing campaign routes - bulk WhatsApp broadcasts. */
export const campaignsRouter: Router = Router();
campaignsRouter.use(authenticate(), tenantScope());

campaignsRouter.get('/', asyncHandler(campaignsController.list));

campaignsRouter.post(
  '/',
  requirePermission('campaign:write'),
  validate({ body: createCampaignSchema }),
  asyncHandler(campaignsController.create),
);

campaignsRouter.get('/:id', validate({ params: idParams }), asyncHandler(campaignsController.get));

campaignsRouter.post(
  '/:id/launch',
  requirePermission('campaign:write'),
  validate({ params: idParams }),
  asyncHandler(campaignsController.launch),
);

campaignsRouter.post(
  '/:id/pause',
  requirePermission('campaign:write'),
  validate({ params: idParams }),
  asyncHandler(campaignsController.pause),
);

campaignsRouter.post(
  '/:id/cancel',
  requirePermission('campaign:write'),
  validate({ params: idParams }),
  asyncHandler(campaignsController.cancel),
);

campaignsRouter.get(
  '/:id/stats',
  validate({ params: idParams }),
  asyncHandler(campaignsController.stats),
);
