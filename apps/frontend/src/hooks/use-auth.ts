import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api/client';
import { useAuthStore } from '../store/slices/auth-slice';
import type {
  LoginInput,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyPhoneInput,
  TwoFactorInput,
} from '../lib/validators/auth.schema';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    merchant: { id: string; companyName: string; plan: string };
  };
}

interface TwoFactorRequiredResponse {
  requires2FA: true;
  tempToken: string;
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation<AuthResponse | TwoFactorRequiredResponse, ApiError, LoginInput>({
    mutationFn: (input) =>
      api<AuthResponse | TwoFactorRequiredResponse>('/auth/login', {
        method: 'POST',
        body: input,
      }),
    onSuccess: (data) => {
      if ('requires2FA' in data) return; // handled by caller
      setSession(data.user, data.accessToken);
    },
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation<AuthResponse, ApiError, RegisterInput>({
    mutationFn: ({ confirmPassword: _confirm, agreeToTerms: _terms, ...input }) =>
      api<AuthResponse>('/auth/register', { method: 'POST', body: input }),
    onSuccess: (data) => setSession(data.user, data.accessToken),
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }).catch(() => undefined),
    onSettled: () => {
      clear();
      queryClient.clear();
    },
  });
}

/** Stores for the switcher — requires an authenticated session. */
export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  whatsappNumber: string | null;
  currency: string;
  status: string;
  _count?: { products: number; orders: number; customers: number };
}

export function useStores(enabled: boolean) {
  return useQuery({
    queryKey: ['stores'],
    queryFn: () => api<StoreSummary[]>('/stores'),
    enabled,
    staleTime: 5 * 60_000,
  });
}

// ---- Auth flow mutations ----

export function useForgotPassword() {
  return useMutation<{ message: string }, ApiError, ForgotPasswordInput>({
    mutationFn: (input) =>
      api('/auth/forgot-password', { method: 'POST', body: input }),
  });
}

export function useResetPassword() {
  return useMutation<{ message: string }, ApiError, ResetPasswordInput & { token: string }>({
    mutationFn: (input) =>
      api('/auth/reset-password', { method: 'POST', body: input }),
  });
}

export function useVerifyEmail() {
  return useMutation<{ message: string }, ApiError, { token: string }>({
    mutationFn: (input) =>
      api('/auth/verify-email', { method: 'POST', body: input }),
  });
}

export function useResendVerification() {
  return useMutation<{ message: string }, ApiError, { email: string }>({
    mutationFn: (input) =>
      api('/auth/resend-verification', { method: 'POST', body: input }),
  });
}

export function useVerifyPhone() {
  return useMutation<AuthResponse, ApiError, VerifyPhoneInput & { tempToken: string }>({
    mutationFn: (input) =>
      api('/auth/verify-phone', { method: 'POST', body: input }),
  });
}

export function useSetup2FA() {
  return useMutation<
    { qrCode: string; secret: string; backupCodes: string[] },
    ApiError,
    void
  >({
    mutationFn: () => api('/auth/2fa/setup', { method: 'POST' }),
  });
}

export function useEnable2FA() {
  return useMutation<{ message: string }, ApiError, { code: string }>({
    mutationFn: (input) =>
      api('/auth/2fa/enable', { method: 'POST', body: input }),
  });
}

export function useVerify2FA() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation<AuthResponse, ApiError, TwoFactorInput & { tempToken: string }>({
    mutationFn: (input) =>
      api('/auth/2fa/verify', { method: 'POST', body: input }),
    onSuccess: (data) => setSession(data.user, data.accessToken),
  });
}

export function useVerify2FABackup() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation<AuthResponse, ApiError, { code: string; tempToken: string }>({
    mutationFn: (input) =>
      api('/auth/2fa/verify-backup', { method: 'POST', body: input }),
    onSuccess: (data) => setSession(data.user, data.accessToken),
  });
}

export function useOAuthLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation<AuthResponse, ApiError, { provider: string; token: string }>({
    mutationFn: (input) =>
      api('/auth/oauth/callback', { method: 'POST', body: input }),
    onSuccess: (data) => setSession(data.user, data.accessToken),
  });
}
