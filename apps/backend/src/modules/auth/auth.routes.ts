import { Router } from 'express';

import { authenticate } from '../../middleware/auth.js';
import { authRateLimit } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { authController } from './auth.controller.js';
import {
  signupSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  twoFactorLoginSchema,
  twoFactorCodeSchema,
  twoFactorDisableSchema,
  verifyEmailConfirmSchema,
  phoneCodeSchema,
  revokeOthersSchema,
} from './auth.dto.js';

/**
 * Auth routes - signup, login, refresh rotation, logout, password flows.
 *
 * Credential endpoints are rate limited hard (authRateLimit) because they are
 * the primary credential-stuffing target; the global API limit also applies
 * on top via the v1 router.
 */
export const authRouter: Router = Router();

// --- Public ------------------------------------------------------------------

authRouter.post('/signup', authRateLimit(), validate({ body: signupSchema }), asyncHandler(authController.signup));

/** Spec-canonical alias for /signup. */
authRouter.post('/register', authRateLimit(), validate({ body: signupSchema }), asyncHandler(authController.signup));

authRouter.post('/login', authRateLimit(), validate({ body: loginSchema }), asyncHandler(authController.login));

authRouter.post('/refresh', validate({ body: refreshSchema }), asyncHandler(authController.refresh));

authRouter.post('/logout', validate({ body: logoutSchema }), asyncHandler(authController.logout));

authRouter.post(
  '/password/forgot',
  authRateLimit(),
  validate({ body: forgotPasswordSchema }),
  asyncHandler(authController.forgotPassword),
);

authRouter.post(
  '/password/reset',
  authRateLimit(),
  validate({ body: resetPasswordSchema }),
  asyncHandler(authController.resetPassword),
);

// --- Authenticated -----------------------------------------------------------

authRouter.get('/me', authenticate(), asyncHandler(authController.me));

authRouter.post(
  '/password/change',
  authenticate(),
  validate({ body: changePasswordSchema }),
  asyncHandler(authController.changePassword),
);

// --- Email & phone verification ------------------------------------------------

authRouter.post('/verify-email/request', authRateLimit(), authenticate(), asyncHandler(authController.requestEmailVerification));

authRouter.post('/verify-email/resend', authRateLimit(), authenticate(), asyncHandler(authController.requestEmailVerification));

authRouter.post(
  '/verify-email/confirm',
  authRateLimit(),
  validate({ body: verifyEmailConfirmSchema }),
  asyncHandler(authController.confirmEmailVerification),
);

authRouter.post('/verify-phone/request', authRateLimit(), authenticate(), asyncHandler(authController.requestPhoneVerification));

authRouter.post('/verify-phone/resend', authRateLimit(), authenticate(), asyncHandler(authController.requestPhoneVerification));

authRouter.post(
  '/verify-phone/confirm',
  authRateLimit(),
  authenticate(),
  validate({ body: phoneCodeSchema }),
  asyncHandler(authController.confirmPhoneVerification),
);

// --- Two-factor -----------------------------------------------------------------

authRouter.post('/2fa/login', authRateLimit(), validate({ body: twoFactorLoginSchema }), asyncHandler(authController.twoFactorLogin));

const twoFactorGuarded = [authenticate()] as const;

authRouter.post('/2fa/setup', ...twoFactorGuarded, asyncHandler(authController.startTwoFactorSetup));

authRouter.post(
  '/2fa/enable',
  ...twoFactorGuarded,
  validate({ body: twoFactorCodeSchema }),
  asyncHandler(authController.confirmTwoFactorSetup),
);

authRouter.post(
  '/2fa/disable',
  ...twoFactorGuarded,
  validate({ body: twoFactorDisableSchema }),
  asyncHandler(authController.disableTwoFactor),
);

// --- Session management ------------------------------------------------------------

authRouter.get('/sessions', ...twoFactorGuarded, asyncHandler(authController.listSessions));

authRouter.delete('/sessions/:sessionId', ...twoFactorGuarded, asyncHandler(authController.revokeSession));

authRouter.post(
  '/sessions/revoke-all',
  ...twoFactorGuarded,
  validate({ body: revokeOthersSchema }),
  asyncHandler(authController.revokeOtherSessions),
);
