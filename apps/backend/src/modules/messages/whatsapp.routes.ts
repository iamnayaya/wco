import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { connectWhatsAppSchema, verifyWhatsAppSchema } from './messages.dto.js';
import { whatsappController } from './whatsapp.controller.js';

/** /api/v1/whatsapp - number connection + health. */
export const whatsappRouter: Router = Router();
whatsappRouter.use(authenticate(), tenantScope());

whatsappRouter.post(
  '/connect',
  requirePermission('store:write'),
  validate({ body: connectWhatsAppSchema }),
  asyncHandler(whatsappController.connect),
);

whatsappRouter.post(
  '/verify',
  requirePermission('store:write'),
  validate({ body: verifyWhatsAppSchema }),
  asyncHandler(whatsappController.verify),
);

whatsappRouter.delete(
  '/disconnect',
  requirePermission('store:write'),
  asyncHandler(whatsappController.disconnect),
);

whatsappRouter.get('/connection', asyncHandler(whatsappController.getConnection));

whatsappRouter.get('/status', asyncHandler(whatsappController.status));
