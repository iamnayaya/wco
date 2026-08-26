import { Router } from 'express';

import { authenticate } from '../../middleware/auth.js';
import { uploadSingle, multerErrorHandler } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { changePasswordSchema } from '../auth/auth.dto.js';

import { meController } from './me.controller.js';
import {
  sellerProfileCreateSchema,
  subscriptionCreateSchema,
  subscriptionUpdateSchema,
  updateMeSchema,
  waConnectionSchema,
  waConnectionUpdateSchema,
} from './user-management.dto.js';

/**
 * Self-service routes. Mounted at /users BEFORE the team-management router so
 * exact `/me` paths win the match; identity comes strictly from the token.
 */
export const userMeRouter: Router = Router();
userMeRouter.use(authenticate());

const me = userMeRouter.route('/me');
me.get(asyncHandler(meController.getMe));
me.put(validate({ body: updateMeSchema }), asyncHandler(meController.updateMe));
me.delete(asyncHandler(meController.deleteMe));

userMeRouter.put(
  '/me/password',
  validate({ body: changePasswordSchema }),
  asyncHandler(meController.changePassword),
);

userMeRouter.post(
  '/me/avatar',
  uploadSingle('avatar'),
  multerErrorHandler,
  asyncHandler(meController.uploadAvatar),
);

userMeRouter
  .route('/me/seller-profile')
  .get(asyncHandler(meController.getSellerProfile))
  .put(
    validate({
      body: sellerProfileCreateSchema.partial().refine((v) => Object.keys(v).length > 0, {
        message: 'No fields to update',
      }),
    }),
    asyncHandler(meController.upsertSellerProfile),
  );

userMeRouter.route('/me/subscription').get(asyncHandler(meController.getSubscription));
userMeRouter.post(
  '/me/subscriptions',
  validate({ body: subscriptionCreateSchema }),
  asyncHandler(meController.createSubscriptionForMe),
);
userMeRouter.put(
  '/me/subscription',
  validate({ body: subscriptionUpdateSchema }),
  asyncHandler(meController.updateSubscriptionForMe),
);
userMeRouter.delete('/me/subscription', asyncHandler(meController.cancelMySubscription));
userMeRouter.post('/me/subscription/renew', asyncHandler(meController.renewMySubscription));

userMeRouter.route('/me/whatsapp').get(asyncHandler(meController.getMyWhatsApp));
userMeRouter.post(
  '/me/whatsapp',
  validate({ body: waConnectionSchema }),
  asyncHandler(meController.createMyWhatsApp),
);
userMeRouter.put(
  '/me/whatsapp',
  validate({ body: waConnectionUpdateSchema }),
  asyncHandler(meController.updateMyWhatsApp),
);
userMeRouter.delete('/me/whatsapp', asyncHandler(meController.deleteMyWhatsApp));
