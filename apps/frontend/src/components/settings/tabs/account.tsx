'use client';

import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '../../../lib/hooks/use-toast';
import { Button, Input, Field, Spinner, EmptyState, Badge } from '../../../components/ui';
import { Modal } from '../../../components/ui/modal';
import { Section, Toggle, ImageUploader } from '../primitives';
import { changePasswordSchema, profileSchema } from '../helpers';
import {
  useDeleteAccount,
  useDisable2fa,
  useEnable2fa,
  useMe,
  useRevokeOtherSessions,
  useRevokeSession,
  useSellerProfile,
  useSessions,
  useSetup2fa,
  useUpdateProfile,
  useUpdateSellerProfile,
  useUploadAvatar,
  useChangePassword,
} from '../hooks';

export function AccountTab() {
  const me = useMe();
  const sellerProfile = useSellerProfile();
  const sessions = useSessions();

  return (
    <div className="space-y-6">
      <ProfileSection fullName={me.data?.fullName} phone={me.data?.phone} avatarUrl={me.data?.avatarUrl} businessName={sellerProfile.data?.businessName} email={me.data?.email} />
      <PasswordSection />
      <TwoFactorSection />
      <SessionsSection sessions={sessions.data ?? []} loading={sessions.isLoading} />
      <DeleteAccountSection />
    </div>
  );
}

// ─── Profile ─────────────────────────────────────────────────────

function ProfileSection({ fullName, phone, avatarUrl, businessName, email }: { fullName?: string | null; phone?: string | null; avatarUrl?: string | null; businessName?: string | null; email?: string | null }) {
  const updateProfile = useUpdateProfile();
  const updateSeller = useUpdateSellerProfile();
  const uploadAvatar = useUploadAvatar();

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<{ fullName: string; phone: string; businessName: string }>({
    resolver: zodResolver(profileSchema.extend({ businessName: profileSchema.shape.fullName })),
    defaultValues: { fullName: fullName ?? '', phone: phone ?? '', businessName: businessName ?? '' },
    values: { fullName: fullName ?? '', phone: phone ?? '', businessName: businessName ?? '' },
  });

  async function onSubmit(data: { fullName: string; phone: string; businessName: string }) {
    await Promise.all([
      updateProfile.mutateAsync({ fullName: data.fullName, phone: data.phone }),
      updateSeller.mutateAsync({ businessName: data.businessName }),
    ]);
    reset(data);
    toast.success('Profile updated');
  }

  async function handleAvatar(file: File) {
    try {
      await uploadAvatar.mutateAsync(file);
      toast.success('Profile picture updated');
    } catch {
      toast.error('Could not upload picture');
    }
  }

  return (
    <Section title="Profile" description="Your personal information and seller identity.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <ImageUploader
          label="Profile picture"
          value={avatarUrl}
          fallbackText={(fullName ?? 'U').slice(0, 2).toUpperCase()}
          uploading={uploadAvatar.isPending}
          onChange={(file) => void handleAvatar(file)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.fullName?.message}>
            <Input {...register('fullName')} aria-invalid={!!errors.fullName} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register('phone')} type="tel" aria-invalid={!!errors.phone} />
          </Field>
          <Field label="Business name" error={errors.businessName?.message}>
            <Input {...register('businessName')} aria-invalid={!!errors.businessName} />
          </Field>
          <Field label="Email">
            <Input value={email ?? ''} disabled />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={updateProfile.isPending} disabled={!isDirty}>
            {updateProfile.isPending ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>
    </Section>
  );
}

// ─── Password ────────────────────────────────────────────────────

interface PasswordForm { currentPassword: string; newPassword: string; confirmPassword: string }

function PasswordSection() {
  const changePassword = useChangePassword();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  });

  async function onSubmit(data: PasswordForm) {
    try {
      await changePassword.mutateAsync({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed');
      reset();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not change password');
    }
  }

  return (
    <Section title="Password" description="Keep your account secure with a strong password.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password" error={errors.currentPassword?.message}>
            <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
          </Field>
          <Field label="New password" error={errors.newPassword?.message}>
            <Input type="password" autoComplete="new-password" {...register('newPassword')} />
          </Field>
          <Field label="Confirm new password" error={errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={changePassword.isPending}>Change password</Button>
        </div>
      </form>
    </Section>
  );
}

// ─── Two-factor ──────────────────────────────────────────────────

function TwoFactorSection() {
  const setup = useSetup2fa();
  const enable = useEnable2fa();
  const disable = useDisable2fa();

  const [mode, setMode] = useState<'idle' | 'setup' | 'enabled' | 'confirm'>('idle');
  const [qr, setQr] = useState<string | undefined>();
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  async function startSetup() {
    const res = await setup.mutateAsync().catch((e) => { toast.error(e?.message ?? 'Could not start setup'); return null; });
    if (res?.qrCode) { setQr(res.qrCode); setBackupCodes(res.backupCodes ?? []); setMode('setup'); }
  }
  async function confirmEnable() {
    try {
      const res = await enable.mutateAsync(code);
      setBackupCodes(res.backupCodes ?? []);
      setMode('enabled');
      toast.success('Two-factor authentication enabled');
    } catch (e: any) { toast.error(e?.message ?? 'Invalid code'); }
  }
  async function confirmDisable(e: FormEvent) {
    e.preventDefault();
    try {
      await disable.mutateAsync(password);
      setMode('idle');
      toast.success('Two-factor authentication disabled');
    } catch (err: any) { toast.error(err?.message ?? 'Could not disable'); }
  }

  if (mode === 'setup') {
    return (
      <Section title="Two-factor authentication" description="Scan the QR code with your authenticator app (e.g. Google Authenticator).">
        {qr && <img src={qr} alt="2FA setup QR code" className="h-44 w-44 rounded-lg border border-slate-200" />}
        <div className="mt-3 space-y-3">
          {backupCodes.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <p className="mb-1 font-semibold">Save these backup codes:</p>
              <pre className="whitespace-pre-wrap font-mono">{backupCodes.join('\n')}</pre>
            </div>
          )}
          <div className="flex max-w-xs items-end gap-2">
            <Field label="6-digit code">
              <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Button onClick={confirmEnable} loading={enable.isPending}>Enable</Button>
          </div>
        </div>
      </Section>
    );
  }

  if (mode === 'enabled') {
    return (
      <Section title="Two-factor authentication" description="Two-factor is enabled.">
        {backupCodes.length > 0 && (
          <div className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <pre className="whitespace-pre-wrap font-mono">{backupCodes.join('\n')}</pre>
          </div>
        )}
        <form onSubmit={confirmDisable} className="max-w-xs space-y-3">
          <Field label="Enter your password to disable">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button variant="danger" type="submit" loading={disable.isPending}>Disable 2FA</Button>
        </form>
      </Section>
    );
  }

  return (
    <Section
      title="Two-factor authentication"
      description="Add an extra layer of security with TOTP-based two-factor authentication."
      action={<Badge label="Disabled" />}
    >
      <Button variant="secondary" onClick={() => void startSetup()} loading={setup.isPending}>Enable 2FA</Button>
    </Section>
  );
}

// ─── Sessions ────────────────────────────────────────────────────

function SessionsSection({ sessions, loading }: { sessions: Array<{ id: string; device?: string; location?: string; lastActiveAt?: string; isCurrent?: boolean }>; loading: boolean }) {
  const revoke = useRevokeSession();
  const revokeAll = useRevokeOtherSessions();

  async function logoutAll() {
    try {
      await revokeAll.mutateAsync();
      toast.success('Logged out of all other devices');
    } catch (e: any) { toast.error(e?.message ?? 'Could not revoke sessions'); }
  }

  return (
    <Section
      title="Active sessions"
      description="Devices currently signed in to your account."
      action={<Button variant="secondary" onClick={() => void logoutAll()} loading={revokeAll.isPending}>Log out of all devices</Button>}
    >
      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : sessions.length === 0 ? (
        <EmptyState title="No active sessions" />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {s.device ?? s.id}
                  {s.isCurrent && <Badge label="This device" tone="NEW" />}
                </p>
                <p className="text-xs text-slate-500">{s.location ?? 'Unknown location'}{s.lastActiveAt ? ` · ${new Date(s.lastActiveAt).toLocaleString()}` : ''}</p>
              </div>
              {!s.isCurrent && (
                <Button variant="ghost" onClick={() => void revoke.mutate(s.id)} loading={revoke.isPending && revoke.variables === s.id}>Log out</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ─── Delete account ──────────────────────────────────────────────

function DeleteAccountSection() {
  const del = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');

  return (
    <Section title="Delete account" description="Permanently delete your account and all associated data. This cannot be undone." className="border-red-200 dark:border-red-900">
      <Button variant="danger" onClick={() => setOpen(true)}>Delete account</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete account?">
        <p className="text-sm text-slate-600">Type <span className="font-semibold">DELETE</span> to permanently delete your account and all data.</p>
        <div className="mt-3 space-y-3">
          <Input placeholder="DELETE" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type DELETE to confirm" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={confirm !== 'DELETE'} loading={del.isPending} onClick={() => void del.mutate()}>Delete forever</Button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}
