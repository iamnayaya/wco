'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useRegister } from '../../../hooks/use-auth';
import { Button, Field, Input } from '../../../components/ui';
import { OAuthButtons, AuthDivider } from '../../../components/auth/oauth-buttons';
import { PasswordStrength } from '../../../components/auth/password-strength';
import { registerSchema, type RegisterInput } from '../../../lib/validators/auth.schema';
import { fadeUp } from '../../../lib/utils/animations';

const COUNTRIES = [
  { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'KE', label: 'Kenya' },
  { value: 'ZA', label: 'South Africa' },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterInput>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: 'NG',
    phone: '',
    agreeToTerms: true as unknown as true,
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const register = useRegister();

  useEffect(() => {
    if (register.isSuccess) router.replace('/stores');
  }, [register.isSuccess, router]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const errors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path[0] as keyof RegisterInput] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    register.mutate(parsed.data, {
      onError: (err) =>
        setFieldErrors({
          email: err.status === 409 ? 'An account with this email already exists' : (err.message ?? 'Registration failed'),
        }),
    });
  };

  const set = <K extends keyof RegisterInput>(key: K) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Start your free trial
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          No credit card required. Set up in 2 minutes.
        </p>

        <div className="mt-6">
          <OAuthButtons onProviderClick={(p) => console.log('oauth', p)} />
        </div>

        <AuthDivider />

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Full name" error={fieldErrors.fullName}>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Ada Obi"
                autoComplete="name"
                className="pl-10"
                value={form.fullName}
                onChange={set('fullName')}
              />
            </div>
          </Field>

          <Field label="Business email" error={fieldErrors.email}>
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Country" error={fieldErrors.country}>
              <select className="input" value={form.country} onChange={set('country')}>
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="WhatsApp (optional)" error={fieldErrors.phone}>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+2348012345678"
                  className="pl-10"
                  value={form.phone}
                  onChange={set('phone')}
                />
              </div>
            </Field>
          </div>

          <Field label="Password" error={fieldErrors.password}>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 10 characters"
                className="pl-10 pr-10"
                value={form.password}
                onChange={set('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrength password={form.password} />
          </Field>

          <Field label="Confirm password" error={fieldErrors.confirmPassword}>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                className="pl-10"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
              />
            </div>
          </Field>

          <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={!!form.agreeToTerms}
              onChange={(e) => setForm((f) => ({ ...f, agreeToTerms: e.target.checked as unknown as true }))}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                Privacy Policy
              </Link>
            </span>
          </label>
          {fieldErrors.agreeToTerms && (
            <p className="text-xs text-red-500">{fieldErrors.agreeToTerms}</p>
          )}

          <Button type="submit" loading={register.isPending} className="w-full">
            Create account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
            Log in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
