import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { renderWrappedHook } from '../../tests/utils/render-utils';
import { createApiMock, mockMutation } from '../../tests/utils/api-mock';
import {
  useLogin,
  useRegister,
  useLogout,
  useForgotPassword,
  useSetup2FA,
} from './use-auth';

const api = createApiMock();
vi.mock('../lib/api/client', () => ({
  api: (...args: Parameters<typeof api.mock>) => api(...args),
  ApiError: class extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string, details?: unknown) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
    details?: unknown;
  },
}));

const SESSION = {
  accessToken: 'at',
  refreshToken: 'rt',
  expiresIn: 900,
  user: {
    id: 'usr_1',
    email: 'nkechi@wco.test',
    fullName: 'Nkechi Okafor',
    role: 'OWNER',
    merchant: { id: 'mch_1', companyName: 'MNC', plan: 'pro' },
  },
};

describe('useLogin', () => {
  it('stores the session on a successful password login', async () => {
    mockMutation('/auth/login', 'POST', SESSION);
    const { result } = renderWrappedHook(() => useLogin());

    act(() => {
      result.current.mutate({ email: 'nkechi@wco.test', password: 'Secret123!' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(SESSION);
  });

  it('does not call setSession when 2FA is required', async () => {
    mockMutation('/auth/login', 'POST', { requires2FA: true, tempToken: 'tmp' });
    const { result } = renderWrappedHook(() => useLogin());

    act(() => {
      result.current.mutate({ email: 'nkechi@wco.test', password: 'Secret123!' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ requires2FA: true });
  });
});

describe('useRegister', () => {
  it('calls /auth/register and drops client-only fields', async () => {
    mockMutation('/auth/register', 'POST', SESSION);
    const { result } = renderWrappedHook(() => useRegister());

    act(() => {
      result.current.mutate({
        fullName: 'Nkechi',
        email: 'nkechi@wco.test',
        password: 'Secret123!',
        confirmPassword: 'Secret123!',
        agreeToTerms: true,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useLogout', () => {
  it('calls /auth/logout and clears the session on settlement', async () => {
    mockMutation('/auth/logout', 'POST', { ok: true });
    const { result } = renderWrappedHook(() => useLogout());

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useForgotPassword', () => {
  it('posts the email and returns the server message', async () => {
    mockMutation('/auth/forgot-password', 'POST', { message: 'Check your inbox' });
    const { result } = renderWrappedHook(() => useForgotPassword());

    act(() => result.current.mutate({ email: 'nkechi@wco.test' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ message: 'Check your inbox' });
  });
});

describe('useSetup2FA', () => {
  it('requests a 2FA setup payload', async () => {
    mockMutation('/auth/2fa/setup', 'POST', {
      qrCode: 'data:image/png;base64,xxx',
      secret: 'SECRET',
      backupCodes: ['a', 'b'],
    });
    const { result } = renderWrappedHook(() => useSetup2FA());

    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.backupCodes).toHaveLength(2);
  });
});
