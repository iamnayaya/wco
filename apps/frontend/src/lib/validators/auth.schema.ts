import { z } from 'zod';

/** Auth form schemas — shared between client validation and types. */
export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Tell us your name').max(120),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(10, 'Use at least 10 characters — length beats complexity'),
    confirmPassword: z.string(),
    country: z.enum(['NG', 'GH', 'KE', 'ZA']),
    phone: z
      .string()
      .regex(/^\+[1-9]\d{7,14}$/, 'Format: +2348012345678')
      .optional()
      .or(z.literal('')),
    agreeToTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must agree to the Terms of Service' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyPhoneSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code'),
});
export type VerifyPhoneInput = z.infer<typeof verifyPhoneSchema>;

export const twoFactorSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code'),
});
export type TwoFactorInput = z.infer<typeof twoFactorSchema>;

export const backupCodeSchema = z.object({
  code: z.string().min(8, 'Enter a valid backup code'),
});
export type BackupCodeInput = z.infer<typeof backupCodeSchema>;
