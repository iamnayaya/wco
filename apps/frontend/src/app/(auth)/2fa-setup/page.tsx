'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, Copy, Check, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui';
import { OTPInput } from '../../../components/auth/otp-input';
import { useSetup2FA, useEnable2FA } from '../../../hooks/use-auth';
import { fadeUp } from '../../../lib/utils/animations';
import { useEffect } from 'react';

export default function TwoFASetupPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const setup2FA = useSetup2FA();
  const enable2FA = useEnable2FA();

  useEffect(() => {
    if (!setup2FA.data && !setup2FA.isPending) {
      setup2FA.mutate();
    }
  }, []);

  const onEnable = () => {
    if (code.length !== 6) return;
    setError('');
    enable2FA.mutate(
      { code },
      {
        onSuccess: () => setTimeout(() => router.replace('/'), 1500),
        onError: (err) => setError(err.message ?? 'Invalid code'),
      },
    );
  };

  const copyToClipboard = async (text: string, type: 'secret' | 'backup') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'secret') { setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000); }
      else { setCopiedBackup(true); setTimeout(() => setCopiedBackup(false), 2000); }
    } catch {}
  };

  if (setup2FA.isPending && !setup2FA.data) {
    return (
      <div className="card p-6 text-center sm:p-8">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600" />
        <p className="mt-4 text-sm text-slate-500">Generating 2FA keys...</p>
      </div>
    );
  }

  if (enable2FA.isSuccess) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="card p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <ShieldCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">2FA enabled!</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Your account is now secured with two-factor authentication.
          </p>
        </div>
      </motion.div>
    );
  }

  const data = setup2FA.data;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <div className="card p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <ShieldCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Set up 2FA</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </p>
        </div>

        {data?.qrCode && (
          <div className="mt-6 flex justify-center">
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.qrCode} alt="QR Code for 2FA setup" className="h-48 w-48" />
            </div>
          </div>
        )}

        {data?.secret && (
          <div className="mt-4">
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              Can&apos;t scan? Enter this key manually:
            </p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <code className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-mono font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {data.secret}
              </code>
              <button
                onClick={() => copyToClipboard(data.secret, 'secret')}
                className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Copy secret key"
              >
                {copiedSecret ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <label className="block text-center text-sm font-medium text-slate-700 dark:text-slate-300">
            Enter the 6-digit code from your app
          </label>
          <div className="relative mt-2">
            <OTPInput value={code} onChange={(v) => { setCode(v); setError(''); }} />
          </div>
          {error && <p className="mt-2 text-center text-sm text-red-500">{error}</p>}
        </div>

        <Button
          onClick={onEnable}
          loading={enable2FA.isPending}
          disabled={code.length !== 6}
          className="mt-6 w-full"

        >
          Enable 2FA
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        {data?.backupCodes && data.backupCodes.length > 0 && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Save your backup codes
            </p>
            <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-300/70">
              Store these somewhere safe. You can use them if you lose access to your authenticator.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.backupCodes.map((code) => (
                <code key={code} className="rounded bg-white px-2 py-0.5 text-xs font-mono dark:bg-slate-800">
                  {code}
                </code>
              ))}
            </div>
            <button
              onClick={() => copyToClipboard(data.backupCodes.join('\n'), 'backup')}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
            >
              {copiedBackup ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedBackup ? 'Copied!' : 'Copy all codes'}
            </button>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-slate-400 hover:underline dark:text-slate-500">
            Skip for now
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
