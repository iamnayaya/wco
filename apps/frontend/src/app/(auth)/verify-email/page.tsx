'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { MailCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { useVerifyEmail, useResendVerification } from '../../../hooks/use-auth';
import { fadeUp } from '../../../lib/utils/animations';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner /></div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email') ?? '';
  const verifyEmail = useVerifyEmail();
  const resendVerification = useResendVerification();
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (token) {
      verifyEmail.mutate(
        { token },
        { onSuccess: () => setTimeout(() => router.replace('/'), 2000) },
      );
    }
  }, [token]);

  if (token && verifyEmail.isPending) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="card p-6 text-center sm:p-8">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Verifying your email...</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Please wait.</p>
        </div>
      </motion.div>
    );
  }

  if (token && verifyEmail.isSuccess) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="card p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <MailCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Email verified!</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Redirecting you to your dashboard...</p>
        </div>
      </motion.div>
    );
  }

  if (token && verifyEmail.isError) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="card p-6 text-center sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Verification failed</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This link is invalid or has expired.</p>
          <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Link>
        </div>
      </motion.div>
    );
  }

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_: string, a: string, b: string, c: string) => a + '*'.repeat(Math.min(b.length, 5)) + c)
    : 'your email';

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <div className="card p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <MailCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Verify your email</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          We sent a verification link to{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">{maskedEmail}</span>.
        </p>
        <p className="mt-1 text-xs text-slate-400">Check your spam folder if you don&apos;t see it.</p>

        <button
          onClick={() => {
            if (email) {
              resendVerification.mutate({ email }, { onSuccess: () => setResent(true) });
            }
          }}
          disabled={!email || resendVerification.isPending || resent}
          className="mt-6 text-sm font-semibold text-emerald-600 hover:underline disabled:opacity-50 dark:text-emerald-400"
        >
          {resent ? 'Verification email sent!' : resendVerification.isPending ? 'Sending...' : 'Resend verification email'}
        </button>

        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Link href="/login" className="text-sm text-slate-500 hover:underline dark:text-slate-400">
            Back to login
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
