'use client';

import { cn } from '../../lib/utils/format';

interface PasswordStrengthProps {
  password: string;
}

function getStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-blue-500' };
  return { score, label: 'Strong', color: 'bg-emerald-500' };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const { score, label, color } = getStrength(password);
  const segments = 5;

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < score ? color : 'bg-slate-200 dark:bg-slate-700',
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          'mt-1 text-xs font-medium',
          score <= 1 && 'text-red-500',
          score === 2 && 'text-amber-500',
          score === 3 && 'text-blue-500',
          score >= 4 && 'text-emerald-500',
        )}
      >
        {label}
      </p>
    </div>
  );
}
