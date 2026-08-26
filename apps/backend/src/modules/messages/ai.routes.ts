import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { aiController } from './ai.controller.js';
import {
  aiConfigUpdateSchema,
  aiDetectIntentSchema,
  aiGenerateSchema,
  aiIntentBodySchema,
  aiIntentParams,
  aiSendSchema,
  aiTestSchema,
} from './messages.dto.js';

/** /api/v1/ai-configurations + /api/v1/ai-responses. */
export const aiConfigRouter: Router = Router();
aiConfigRouter.use(authenticate(), tenantScope());

aiConfigRouter.get('/', asyncHandler(aiController.getConfig));

aiConfigRouter.put(
  '/',
  requirePermission('store:write'),
  validate({ body: aiConfigUpdateSchema }),
  asyncHandler(aiController.updateConfig),
);

aiConfigRouter.delete(
  '/',
  requirePermission('store:write'),
  asyncHandler(aiController.deleteConfig),
);

aiConfigRouter.post(
  '/test',
  validate({ body: aiTestSchema }),
  asyncHandler(aiController.test),
);

// --- taught intents (nested sub-resource) -------------------------------------

aiConfigRouter.get('/intents', asyncHandler(aiController.listIntents));

aiConfigRouter.post(
  '/intents',
  requirePermission('store:write'),
  validate({ body: aiIntentBodySchema }),
  asyncHandler(aiController.createIntent),
);

aiConfigRouter.put(
  '/intents/:intentId',
  requirePermission('store:write'),
  validate({ params: aiIntentParams, body: aiIntentBodySchema.partial() }),
  asyncHandler(aiController.updateIntent),
);

aiConfigRouter.delete(
  '/intents/:intentId',
  requirePermission('store:write'),
  validate({ params: aiIntentParams }),
  asyncHandler(aiController.deleteIntent),
);

export const aiResponsesRouter: Router = Router();
aiResponsesRouter.use(authenticate(), tenantScope());

aiResponsesRouter.post(
  '/detect-intent',
  validate({ body: aiDetectIntentSchema }),
  asyncHandler(aiController.detectIntent),
);

aiResponsesRouter.post(
  '/extract-entities',
  validate({ body: aiDetectIntentSchema }),
  asyncHandler(aiController.extractEntities),
);

aiResponsesRouter.post(
  '/generate',
  validate({ body: aiGenerateSchema }),
  asyncHandler(aiController.generate),
);

aiResponsesRouter.post(
  '/send',
  requirePermission('conversation:handle'),
  validate({ body: aiSendSchema }),
  asyncHandler(aiController.sendAsBot),
);
