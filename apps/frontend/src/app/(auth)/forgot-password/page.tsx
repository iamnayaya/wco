'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button, Field, Input } from '../../../components/ui';
import { useForgotPassword } from '../../../hooks/use-auth';
import { forgotPasswordSchema, type ForgotPasswordInput } from '../../../lib/validators/auth.schema';
import { fadeUp } from '../../../lib/utils/animations';

export default function ForgotPasswordPage() {
  const [form, setForm] = useState<ForgotPasswordInput>({ email: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ForgotPasswordInput, string>>>({});
  const forgotPassword = useForgotPassword();
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse(form);
    if (!parsed.success) {
      const errors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path[0] as keyof ForgotPasswordInput] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    forgotPassword.mutate(parsed.data, {
      onSuccess: () => setSubmitted(true),
      onError: (err) => setFieldErrors({ email: err.message ?? 'Something went wrong' }),
    });
  };

  if (submitted) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="card p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Check your email</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            We sent password reset instructions to{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">{form.email}</span>.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Didn&apos;t receive it? Check spam or{' '}
            <button onClick={() => setSubmitted(false)} className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
              try again
            </button>.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Forgot your password?</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Enter your email and we&apos;ll send a reset link.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
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
                onChange={(e) => setForm({ email: e.target.value })}
              />
            </div>
          </Field>

          <Button type="submit" loading={forgotPassword.isPending} className="w-full">
            Send reset link
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Remember your password?{' '}
          <Link href="/login" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
            Log in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
