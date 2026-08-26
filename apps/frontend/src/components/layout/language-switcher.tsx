'use client';

import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../../lib/i18n';
import { cn } from '../../lib/utils/format';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation();

  return (
    <select
      aria-label="Select language"
      className={cn(
        'rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-7 text-sm font-medium text-slate-700',
        'hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500',
        'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600',
        className,
      )}
      value={i18n.language}
      onChange={(e) => {
        void i18n.changeLanguage(e.target.value);
      }}
    >
      {supportedLanguages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
