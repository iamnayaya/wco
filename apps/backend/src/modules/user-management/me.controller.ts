import { UnauthorizedError, ValidationError, NotFoundError } from '@wco/shared';
import type { Request, Response } from 'express';

import { prisma } from '../../lib/prisma.js';
import { getAuth } from '../../middleware/rbac.js';
import { authService } from '../../services/auth.service.js';
import { notificationService } from '../../services/notification.service.js';
import { uploadsService } from '../../services/uploads.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { changePasswordSchema } from '../auth/auth.dto.js';

import { sellerProfileService } from './services/profiles.service.js';
import { subscriptionService } from './services/subscription.service.js';
import { userService } from './services/user.service.js';
import { whatsappConnectionService } from './services/whatsapp-connection.service.js';

/**
 * Self-service endpoints under /users/me. Identity comes from the access
 * token only - no id params, so a seller can never address another user.
 */

async function requireUser(req: Request): Promise<MeUser> {
  const auth = getAuth(req);
  if (!auth.userId) throw new UnauthorizedError();
  return userService.getUserById(auth.userId);
}

type MeUser = Awaited<ReturnType<typeof userService.getUserById>>;

export const meController = {
  async getMe(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await requireUser(req));
  },

  async updateMe(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    const user = await userService.updateMe(auth.userId, auth.merchantId, req.body);
    void notificationService.sendEmail('profile-updated', user.email, {});
    sendSuccess(res, user);
  },

  /** GDPR-style exit: soft delete + session revocation; audit rows survive. */
  async deleteMe(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    await userService.deleteUser(auth.userId);
    sendSuccess(res, { deleted: true });
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    const body = changePasswordSchema.parse(req.body);
    await authService.changePassword(auth.userId, body.currentPassword, body.newPassword);
    const user = await userService.getUserById(auth.userId);
    void notificationService.sendEmail('password-changed', user.email, {});
    sendSuccess(res, { changed: true });
  },

  /** Avatar upload - reuses the S3 media pipeline (multer + magic-byte check). */
  async uploadAvatar(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    const file = req.file;
    if (!file) throw new ValidationError('File is required', { field: 'avatar' });
    const result = await uploadsService.upload(`u_${auth.userId}`, 'avatars', {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    const user = await prisma.user.update({ where: { id: auth.userId }, data: { avatarUrl: result.url } });
    sendSuccess(res, { avatarUrl: user.avatarUrl, key: result.key }, undefined, 201);
  },

  // --- profile sub-resources ----------------------------------------------

  async getSellerProfile(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    try {
      sendSuccess(res, await sellerProfileService.getSellerProfileByUserId(auth.userId));
    } catch {
      sendSuccess(res, null);
    }
  },

  async upsertSellerProfile(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    let profile;
    try {
      profile = await sellerProfileService.updateSellerProfile(auth.userId, req.body);
    } catch (err) {
      if (err instanceof NotFoundError) {
        profile = await sellerProfileService.createSellerProfile(
          auth.userId,
          (req.body.businessName ? req.body : { ...req.body, businessName: 'My Business' }) as never,
        );
      } else {
        throw err;
      }
    }
    sendSuccess(res, profile, undefined, 201);
  },

  async getSubscription(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    try {
      sendSuccess(res, await subscriptionService.getSubscriptionByUserId(auth.userId));
    } catch {
      sendSuccess(res, null);
    }
  },

  async createSubscriptionForMe(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    const sub = await subscriptionService.createSubscription(auth.userId, req.body.planCode, req.body.billingCycle);
    sendSuccess(res, sub, undefined, 201);
  },

  async updateSubscriptionForMe(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    sendSuccess(res, await subscriptionService.updateSubscription(auth.userId, req.body));
  },

  async cancelMySubscription(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    await subscriptionService.cancelSubscription(auth.userId);
    sendSuccess(res, { cancelled: true });
  },

  async renewMySubscription(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    sendSuccess(res, await subscriptionService.renewSubscription(auth.userId));
  },

  // --- WhatsApp connection -------------------------------------------------

  async getMyWhatsApp(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    try {
      sendSuccess(res, await whatsappConnectionService.getWhatsAppConnectionByUserId(auth.userId));
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendSuccess(res, null);
        return;
      }
      throw err;
    }
  },

  async createMyWhatsApp(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    sendSuccess(res, await whatsappConnectionService.createWhatsAppConnection(auth.userId, req.body), undefined, 201);
  },

  async updateMyWhatsApp(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    sendSuccess(res, await whatsappConnectionService.updateWhatsAppConnection(auth.userId, req.body));
  },

  async deleteMyWhatsApp(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    if (!auth.userId) throw new UnauthorizedError();
    await whatsappConnectionService.deleteWhatsAppConnection(auth.userId);
    sendSuccess(res, { deleted: true });
  },
} as const;
