'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button, Field, Input, Spinner } from '../../../components/ui';
import { useResetPassword } from '../../../hooks/use-auth';
import { resetPasswordSchema, type ResetPasswordInput } from '../../../lib/validators/auth.schema';
import { fadeUp } from '../../../lib/utils/animations';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner /></div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [form, setForm] = useState<ResetPasswordInput>({ password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ResetPasswordInput, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const resetPassword = useResetPassword();

  if (!token) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="card p-6 text-center sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invalid link</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            This password reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Request a new link
          </Link>
        </div>
      </motion.div>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse(form);
    if (!parsed.success) {
      const errors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path[0] as keyof ResetPasswordInput] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    resetPassword.mutate({ ...parsed.data, token }, {
      onSuccess: () => setSubmitted(true),
      onError: (err) => setFieldErrors({ password: err.message ?? 'Reset failed' }),
    });
  };

  if (submitted) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="card p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Password updated</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Your password has been changed. You can now log in.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to login
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose a strong new password for your account.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Field label="New password" error={fieldErrors.password}>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 10 characters"
                className="pl-10 pr-10"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
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
          </Field>

          <Field label="Confirm new password" error={fieldErrors.confirmPassword}>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                className="pl-10"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              />
            </div>
          </Field>

          <Button type="submit" loading={resetPassword.isPending} className="w-full">
            Reset password
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
