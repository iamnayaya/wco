import { z } from 'zod';

/**
 * Auth DTOs - request contracts for the session lifecycle.
 *
 * The refresh token travels in the body (mobile-friendly); web may also
 * prefer httpOnly cookies later without contract changes.
 */

export const emailSchema = z.string().email().max(254).transform((v) => v.toLowerCase());
export const passwordSchema = z.string().min(8).max(128);

export const signupSchema = z.object({
  companyName: z.string().min(2).max(120),
  fullName: z.string().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().max(20).optional(),
  country: z.enum(['NG', 'GH', 'KE']).default('NG'),
});

export const loginSchema = z
  .object({
    email: emailSchema.optional(),
    /** Email OR phone - preferred going forward; `email` kept for compat. */
    identifier: z.string().min(3).max(254).optional(),
    password: z.string().min(1).max(128),
  })
  .refine((v) => Boolean(v.email || v.identifier), {
    message: 'Provide email or identifier',
    path: ['identifier'],
  });

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(512) });

export const logoutSchema = refreshSchema.extend({ accessToken: z.string().optional() });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(255),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

// --- Two-factor ---------------------------------------------------------------

export const twoFactorLoginSchema = z.object({
  challengeId: z.string().min(16).max(128),
  code: z.string().min(6).max(11), // TOTP "123456" or backup "XXXXX-XXXXX"
});

export const twoFactorCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/u, '6-digit code required') });

export const twoFactorDisableSchema = z.object({ password: z.string().min(1) });

// --- Verification -----------------------------------------------------------------

export const verifyEmailConfirmSchema = z.object({ token: z.string().min(20).max(255) });

export const phoneCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/u, '6-digit code required') });

// --- Sessions ------------------------------------------------------------------------

export const revokeOthersSchema = z.object({ refreshToken: z.string().min(20).max(512).optional() });

export type SignupDto = z.infer<typeof signupSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

/** Public user projection - never leaks passwordHash or internal flags. */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  merchantId: string;
}

export function toPublicUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  merchantId: string;
}): PublicUser {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role, merchantId: user.merchantId };
}
