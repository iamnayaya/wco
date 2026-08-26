import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { uploadMessageMedia, multerErrorHandler } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { messagesController } from './messages.controller.js';
import {
  idParams,
  listMessagesQuerySchema,
  messageStatsQuerySchema,
  receiveMessageSchema,
  searchMessagesQuerySchema,
  sendMessageSchema,
  updateMessageSchema,
} from './messages.dto.js';

/** /api/v1/messages - store-wide feed, sends, attachments, ingress. */
export const messagesRouter: Router = Router();
messagesRouter.use(authenticate(), tenantScope());

messagesRouter.get(
  '/',
  validate({ query: listMessagesQuerySchema }),
  asyncHandler(messagesController.list),
);

messagesRouter.get(
  '/search',
  validate({ query: searchMessagesQuerySchema }),
  asyncHandler(messagesController.search),
);

messagesRouter.get(
  '/export',
  validate({ query: listMessagesQuerySchema }),
  asyncHandler(messagesController.exportCsv),
);

messagesRouter.post(
  '/send',
  requirePermission('conversation:handle'),
  validate({ body: sendMessageSchema }),
  asyncHandler(messagesController.send),
);

messagesRouter.post(
  '/receive',
  validate({ body: receiveMessageSchema }),
  asyncHandler(messagesController.receive),
);

messagesRouter.get(
  '/stats',
  validate({ query: messageStatsQuerySchema }),
  asyncHandler(messagesController.stats),
);

messagesRouter.post(
  '/:id/attachments',
  requirePermission('conversation:handle'),
  uploadMessageMedia('file'),
  multerErrorHandler,
  asyncHandler(messagesController.uploadAttachment),
);

messagesRouter.get(
  '/:id/attachments',
  asyncHandler(messagesController.listAttachments),
);

messagesRouter.get(
  '/:id',
  validate({ params: idParams }),
  asyncHandler(messagesController.get),
);

messagesRouter.put(
  '/:id',
  requirePermission('conversation:handle'),
  validate({ params: idParams, body: updateMessageSchema }),
  asyncHandler(messagesController.update),
);

messagesRouter.delete(
  '/:id',
  requirePermission('conversation:handle'),
  validate({ params: idParams }),
  asyncHandler(messagesController.remove),
);
