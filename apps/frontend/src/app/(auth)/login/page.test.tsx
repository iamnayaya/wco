import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '@/store/slices/auth-slice';
import { renderWithProviders } from '../../../../tests/utils/render-utils';
import MockRouter from '../../../../tests/utils/next-router-mock';
import LoginPage from './page';

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));

vi.mock('@/lib/api/client', () => ({
  api: mockApi,
  ApiError: class extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  PaginatedResponse: (z: unknown) => z,
  OrderSchema: {},
}));

vi.mock('next/navigation', () => ({
  useRouter: () => globalThis.__router,
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}));

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

/**
 * Integration test for the Login page: renders the real component with a real
 * QueryClient + auth store (only the router, animation, and network are
 * stubbed) and exercises validation + the success/2FA navigation paths.
 */

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

function makeRouter() {
  const value = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  };
  (globalThis as any).__router = value;
  return value;
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email address'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: /log in/i }));
  return user;
}

describe('LoginPage', () => {
  let router: ReturnType<typeof makeRouter>;

  beforeEach(() => {
    mockApi.mockReset();
    router = makeRouter();
    useAuthStore.getState().clearSession();
  });
  afterEach(() => vi.clearAllMocks());

  it('renders the auth form controls', () => {
    renderWithProviders(<LoginPage />, { authenticated: false });
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows client-side validation errors for invalid input', async () => {
    renderWithProviders(<LoginPage />, { authenticated: false });
    await fillAndSubmit('not-an-email', '');
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('sets the session and routes to /dashboard on successful login', async () => {
    mockApi.mockResolvedValue(SESSION);
    renderWithProviders(<LoginPage />, { authenticated: false });
    await fillAndSubmit('nkechi@wco.test', 'Secret12345');
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('at'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('routes to 2FA when the server returns requires2FA', async () => {
    mockApi.mockResolvedValue({ requires2FA: true, tempToken: 'tmp-1' });
    renderWithProviders(<LoginPage />, { authenticated: false });
    await fillAndSubmit('nkechi@wco.test', 'Secret12345');
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/2fa-login?token=tmp-1'));
  });

  it('surfaces an authentication failure on 401', async () => {
    const err = new Error('Invalid credentials');
    (err as any).status = 401;
    mockApi.mockRejectedValue(err);
    renderWithProviders(<LoginPage />, { authenticated: false });
    await fillAndSubmit('nkechi@wco.test', 'WrongPass1');
    expect(await screen.findByText('Email or password is incorrect')).toBeInTheDocument();
  });
});
