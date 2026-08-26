import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { conversationsController } from './conversations.controller.js';
import {
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  sendMessageSchema,
  assignAgentSchema,
  botToggleSchema,
  idParams,
} from './conversations.dto.js';

/** Conversations routes - the WhatsApp inbox (threads + message sending). */
export const conversationsRouter: Router = Router();
conversationsRouter.use(authenticate(), tenantScope());

conversationsRouter.get(
  '/',
  validate({ query: listConversationsQuerySchema }),
  asyncHandler(conversationsController.list),
);

conversationsRouter.get(
  '/:id/messages',
  validate({ params: idParams, query: listMessagesQuerySchema }),
  asyncHandler(conversationsController.messages),
);

conversationsRouter.post(
  '/:id/messages',
  requirePermission('conversation:handle'),
  validate({ params: idParams, body: sendMessageSchema }),
  asyncHandler(conversationsController.sendMessage),
);

conversationsRouter.post(
  '/:id/assign',
  requirePermission('conversation:handle'),
  validate({ params: idParams, body: assignAgentSchema }),
  asyncHandler(conversationsController.assignAgent),
);

conversationsRouter.post(
  '/:id/bot',
  requirePermission('conversation:handle'),
  validate({ params: idParams, body: botToggleSchema }),
  asyncHandler(conversationsController.setBotEnabled),
);

conversationsRouter.post(
  '/:id/escalate',
  requirePermission('conversation:handle'),
  validate({ params: idParams }),
  asyncHandler(conversationsController.escalate),
);
