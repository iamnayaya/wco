import type { Request, Response } from 'express';

import { getAuth, getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';

import { whatsAppConnectionService } from './services/whatsapp-connection.service.js';

/** WhatsApp Business number lifecycle (Meta Cloud API). */
export const whatsappController = {
  async connect(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    const connection = await whatsAppConnectionService.connect(
      getStoreId(req),
      auth.merchantId,
      req.body as { phone: string; displayName?: string },
    );
    sendSuccess(res, connection, undefined, 201);
  },

  async verify(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    const connection = await whatsAppConnectionService.verify(
      getStoreId(req),
      auth.merchantId,
      req.body as { phoneNumberId: string; wabaId?: string },
    );
    sendSuccess(res, connection);
  },

  async disconnect(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    const connection = await whatsAppConnectionService.disconnect(getStoreId(req), auth.merchantId);
    sendSuccess(res, connection);
  },

  async getConnection(req: Request, res: Response): Promise<void> {
    const connection = await whatsAppConnectionService.getConnection(getStoreId(req), getAuth(req).merchantId);
    sendSuccess(res, connection);
  },

  async status(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await whatsAppConnectionService.status(getStoreId(req)));
  },
} as const;
