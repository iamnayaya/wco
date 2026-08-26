import type { Request, Response } from 'express';

import { authService } from '../../services/auth.service.js';
import { tokenService } from '../../services/token.service.js';
import { sendSuccess } from '../../utils/api-response.js';

import { toPublicUser, type PublicUser } from './auth.dto.js';

/**
 * Auth controller - thin HTTP adapters over AuthService.
 *
 * Session metadata (ip / user-agent) is harvested here because it is a
 * transport concern; the service stays transport-agnostic for reuse by the
 * CLI and future gRPC surfaces.
 */

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

function sessionMeta(req: Request): { ip?: string; userAgent?: string } {
  return {
    ip: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

/** authenticate() guarantees req.auth on these routes; centralize the guard. */
function requireUserId(req: Request): string {
  if (!req.auth?.userId) throw new Error('unreachable after authenticate()');
  return req.auth.userId;
}

export const authController = {
  async signup(req: Request, res: Response): Promise<void> {
    const { merchant, user } = await authService.signup(req.body);
    const tokens = await authService.issueSessionFor(user, sessionMeta(req));
    sendSuccess(
      res,
      {
        merchant: { id: merchant.id, name: merchant.companyName },
        user: toPublicUser(user),
        ...tokens,
      },
      undefined,
      201,
    );
  },
  async login(req: Request, res: Response): Promise<void> {
    const identifier =
      typeof req.body.identifier === 'string' && req.body.identifier ? req.body.identifier : req.body.email;
    const { user, tokens, twoFactorChallenge } = await authService.login(identifier, req.body.password, sessionMeta(req));
    if (twoFactorChallenge || !tokens) {
      sendSuccess(res, { twoFactorRequired: true, challengeId: twoFactorChallenge?.challengeId });
      return;
    }
    sendSuccess(res, { user: toPublicUser(user), ...tokens });
  },

  /** Completes a TOTP challenge started by /login. */
  async twoFactorLogin(req: Request, res: Response): Promise<void> {
    const { user, tokens } = await authService.completeTwoFactorLogin(
      req.body.challengeId,
      req.body.code,
      sessionMeta(req),
    );
    sendSuccess(res, { user: toPublicUser(user), ...tokens });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const { user, tokens } = await authService.refresh(req.body.refreshToken, sessionMeta(req));
    sendSuccess(res, { user: toPublicUser(user), ...tokens });
  },

  async logout(req: Request, res: Response): Promise<void> {
    await authService.logout(req.body.refreshToken);
    // Kill the access token immediately too (denylist until natural expiry).
    if (typeof req.body.accessToken === 'string') await tokenService.denylistAccessToken(req.body.accessToken);
    sendSuccess(res, { loggedOut: true });
  },

  /** Always succeeds externally - no account enumeration via this endpoint. */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    await authService.requestPasswordReset(req.body.email);
    sendSuccess(res, { queued: true });
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    await authService.confirmPasswordReset(req.body.token, req.body.newPassword);
    sendSuccess(res, { reset: true });
  },

  async me(req: Request, res: Response): Promise<void> {
    sendSuccess(res, req.auth);
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    await authService.changePassword(requireUserId(req), req.body.currentPassword, req.body.newPassword);
    sendSuccess(res, { changed: true });
  },

  // --- Verification -----------------------------------------------------------

  async requestEmailVerification(req: Request, res: Response): Promise<void> {
    await authService.requestEmailVerification(requireUserId(req));
    sendSuccess(res, { queued: true });
  },

  async confirmEmailVerification(req: Request, res: Response): Promise<void> {
    await authService.confirmEmailVerification(req.body.token);
    sendSuccess(res, { verified: true });
  },

  async requestPhoneVerification(req: Request, res: Response): Promise<void> {
    await authService.requestPhoneVerification(requireUserId(req));
    sendSuccess(res, { queued: true });
  },

  async confirmPhoneVerification(req: Request, res: Response): Promise<void> {
    await authService.confirmPhoneVerification(requireUserId(req), req.body.code);
    sendSuccess(res, { verified: true });
  },

  // --- Two-factor --------------------------------------------------------------

  async startTwoFactorSetup(req: Request, res: Response): Promise<void> {
    const { otpauthUri: uri } = await authService.startTwoFactorSetup(requireUserId(req));
    sendSuccess(res, { otpauthUri: uri });
  },

  async confirmTwoFactorSetup(req: Request, res: Response): Promise<void> {
    const { backupCodes } = await authService.confirmTwoFactorSetup(requireUserId(req), req.body.code);
    sendSuccess(res, { enabled: true, backupCodes });
  },

  async disableTwoFactor(req: Request, res: Response): Promise<void> {
    await authService.disableTwoFactor(requireUserId(req), req.body.password);
    sendSuccess(res, { enabled: false });
  },

  // --- Sessions -----------------------------------------------------------------

  async listSessions(req: Request, res: Response): Promise<void> {
    const sessions = await authService.listSessions(requireUserId(req));
    sendSuccess(res, { sessions });
  },

  async revokeSession(req: Request, res: Response): Promise<void> {
    await authService.revokeSession(requireUserId(req), req.params.sessionId);
    sendSuccess(res, { revoked: true });
  },

  async revokeOtherSessions(req: Request, res: Response): Promise<void> {
    const revoked = await authService.revokeOtherSessions(requireUserId(req), req.body.refreshToken);
    sendSuccess(res, { revoked });
  },
} as const;

export type { PublicUser };
