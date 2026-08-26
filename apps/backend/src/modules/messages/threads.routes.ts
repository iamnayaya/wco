import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  createThreadSchema,
  listThreadsQuerySchema,
  outboundBody,
  threadMessagesQuerySchema,
  threadParams,
  updateThreadSchema,
} from './messages.dto.js';
import { threadsController } from './threads.controller.js';

/** /api/v1/message-threads - WhatsApp inbox threads. */
export const messageThreadsRouter: Router = Router();
messageThreadsRouter.use(authenticate(), tenantScope());

messageThreadsRouter.get(
  '/',
  validate({ query: listThreadsQuerySchema }),
  asyncHandler(threadsController.list),
);

messageThreadsRouter.post(
  '/',
  requirePermission('conversation:handle'),
  validate({ body: createThreadSchema }),
  asyncHandler(threadsController.create),
);

messageThreadsRouter.get(
  '/:id',
  validate({ params: threadParams }),
  asyncHandler(threadsController.get),
);

messageThreadsRouter.patch(
  '/:id',
  requirePermission('conversation:handle'),
  validate({ params: threadParams, body: updateThreadSchema }),
  asyncHandler(threadsController.update),
);

messageThreadsRouter.delete(
  '/:id',
  requirePermission('conversation:handle'),
  validate({ params: threadParams }),
  asyncHandler(threadsController.remove),
);

messageThreadsRouter.get(
  '/:id/messages',
  validate({ params: threadParams, query: threadMessagesQuerySchema }),
  asyncHandler(threadsController.messages),
);

messageThreadsRouter.post(
  '/:id/messages',
  requirePermission('conversation:handle'),
  validate({ params: threadParams, body: outboundBody }),
  asyncHandler(threadsController.send),
);
