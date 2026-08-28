'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useLogin } from '../../../hooks/use-auth';
import { Button, Field, Input } from '../../../components/ui';
import { OAuthButtons, AuthDivider } from '../../../components/auth/oauth-buttons';
import { loginSchema, type LoginInput } from '../../../lib/validators/auth.schema';
import { fadeUp } from '../../../lib/utils/animations';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginInput>({ email: '', password: '', rememberMe: false });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();

  useEffect(() => {
    if (login.isSuccess && !('requires2FA' in (login.data ?? {}))) {
      router.replace('/dashboard');
    }
    if (login.isSuccess && 'requires2FA' in (login.data ?? {})) {
      const { tempToken } = login.data as { tempToken: string };
      router.push(`/2fa-login?token=${tempToken}`);
    }
  }, [login.isSuccess, login.data, router]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      const errors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path[0] as keyof LoginInput] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    login.mutate(parsed.data, {
      onError: (err) => {
        if (err.status === 423) {
          setFieldErrors({ email: 'Account locked. Please try again later or reset your password.' });
        } else {
          setFieldErrors({
            password: err.status === 401 ? 'Email or password is incorrect' : (err.message ?? 'Something went wrong'),
          });
        }
      },
    });
  };

  const set = (key: keyof LoginInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: key === 'rememberMe' ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Log in to manage your WhatsApp business.
        </p>

        <div className="mt-6">
          <OAuthButtons onProviderClick={(p) => console.log('oauth', p)} />
        </div>

        <AuthDivider />

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email address" error={fieldErrors.email}>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@business.com"
                className="pl-10"
                value={form.email}
                onChange={set('email')}
              />
            </div>
          </Field>

          <Field label="Password" error={fieldErrors.password}>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="pl-10 pr-10"
                value={form.password}
                onChange={set('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={form.rememberMe}
                onChange={set('rememberMe')}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={login.isPending} className="w-full">
            Log in
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
            Sign up free
          </Link>
        </p>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
          By continuing, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-slate-600">Terms of Service</Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>.
        </p>
      </div>
    </motion.div>
  );
}
