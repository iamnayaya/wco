'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, Key } from 'lucide-react';
import { Button, Spinner } from '../../../components/ui';
import { OTPInput } from '../../../components/auth/otp-input';
import { useVerify2FA, useVerify2FABackup } from '../../../hooks/use-auth';
import { fadeUp } from '../../../lib/utils/animations';

export default function TwoFALoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner /></div>}>
      <TwoFALoginInner />
    </Suspense>
  );
}

function TwoFALoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get('token') ?? '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const verify2FA = useVerify2FA();
  const verifyBackup = useVerify2FABackup();

  if (!tempToken) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="card p-6 text-center sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invalid session</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Please log in again.</p>
          <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Go to login
          </Link>
        </div>
      </motion.div>
    );
  }

  const onSubmit = () => {
    if (useBackup) {
      if (code.length < 8) return;
      setError('');
      verifyBackup.mutate(
        { code, tempToken },
        { onError: (err) => setError(err.message ?? 'Invalid backup code') },
      );
    } else {
      if (code.length !== 6) return;
      setError('');
      verify2FA.mutate(
        { code, tempToken },
        { onError: (err) => setError(err.message ?? 'Invalid code') },
      );
    }
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <div className="card p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <ShieldCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {useBackup ? 'Use backup code' : 'Two-factor authentication'}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {useBackup
            ? 'Enter one of your backup codes'
            : 'Enter the 6-digit code from your authenticator app'}
        </p>

        <div className="relative mt-6">
          {useBackup ? (
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder="ABCD-EFGH"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center font-mono text-lg tracking-widest dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              autoFocus
            />
          ) : (
            <OTPInput value={code} onChange={(v) => { setCode(v); setError(''); }} />
          )}
        </div>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <Button onClick={onSubmit} loading={verify2FA.isPending || verifyBackup.isPending} disabled={useBackup ? code.length < 8 : code.length !== 6} className="mt-6 w-full">
          Verify
        </Button>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => { setUseBackup(!useBackup); setCode(''); setError(''); }}
            className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <Key className="h-3.5 w-3.5" />
            {useBackup ? 'Use authenticator app' : 'Use a backup code'}
          </button>
          <Link href="/login" className="text-sm text-slate-400 hover:underline dark:text-slate-500">
            Back to login
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
