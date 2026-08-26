'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Smartphone, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button, Spinner } from '../../../components/ui';
import { OTPInput } from '../../../components/auth/otp-input';
import { useVerifyPhone } from '../../../hooks/use-auth';
import { verifyPhoneSchema } from '../../../lib/validators/auth.schema';
import { fadeUp } from '../../../lib/utils/animations';

export default function VerifyPhonePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner /></div>}>
      <VerifyPhoneInner />
    </Suspense>
  );
}

function VerifyPhoneInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get('token') ?? '';
  const phone = searchParams.get('phone') ?? '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const verifyPhone = useVerifyPhone();

  const maskedPhone = phone
    ? phone.replace(/(\+\d{3})\d+(\d{4})/, '$1***$2')
    : 'your phone';

  const onSubmit = () => {
    const parsed = verifyPhoneSchema.safeParse({ code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the 6-digit code');
      return;
    }
    setError('');
    verifyPhone.mutate(
      { code, tempToken },
      {
        onSuccess: () => setTimeout(() => router.replace('/'), 2000),
        onError: (err) => setError(err.message ?? 'Invalid code'),
      },
    );
  };

  if (!tempToken) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="card p-6 text-center sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invalid session</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Please log in again to verify your phone number.
          </p>
          <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Go to login
          </Link>
        </div>
      </motion.div>
    );
  }

  if (verifyPhone.isSuccess) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="card p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Phone verified!</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Redirecting to your dashboard...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <div className="card p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Smartphone className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Verify your phone</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Enter the 6-digit code sent to{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">{maskedPhone}</span>
        </p>

        <div className="relative mt-6">
          <OTPInput value={code} onChange={(v) => { setCode(v); setError(''); }} />
        </div>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <Button onClick={onSubmit} loading={verifyPhone.isPending} disabled={code.length !== 6} className="mt-6 w-full">
          Verify
        </Button>

        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Link href="/login" className="text-sm text-slate-500 hover:underline dark:text-slate-400">
            Back to login
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
