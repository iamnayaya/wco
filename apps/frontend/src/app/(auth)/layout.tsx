import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { ThemeToggle } from '../../components/layout/theme-toggle';
import { LanguageSwitcher } from '../../components/layout/language-switcher';

export const dynamic = 'force-dynamic';

const TRUST_ITEMS = [
  '12,000+ active sellers',
  '8 countries across Africa & Asia',
  '99.9% uptime SLA',
  'Bank-grade security',
] as const;

/**
 * Auth shell — split layout on desktop, centered card on mobile.
 * Right panel shows trust signals and branding.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left — Form panel */}
      <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
        <div className="flex items-center justify-between px-6 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="WCO Home">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <MessageCircle className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              WCO
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="px-6 py-4 text-center text-xs text-slate-400 dark:text-slate-500 lg:hidden">
          &copy; {new Date().getFullYear()} WhatsApp Commerce OS. All rights reserved.
        </footer>
      </div>

      {/* Right — Branding panel (hidden on mobile) */}
      <div className="hidden w-[480px] shrink-0 bg-gradient-to-br from-emerald-600 to-emerald-700 lg:flex lg:flex-col lg:justify-between lg:p-10 xl:w-[540px]">
        <div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white">
            <MessageCircle className="h-5 w-5" />
          </div>
          <h2 className="mt-8 text-3xl font-bold leading-tight text-white xl:text-4xl">
            The AI-powered operating system for WhatsApp commerce
          </h2>
          <p className="mt-4 text-base leading-relaxed text-emerald-100">
            Manage products, orders, payments, and deliveries — all from one dashboard.
            Your AI assistant handles customer conversations 24/7.
          </p>
        </div>

        <div className="space-y-3">
          {TRUST_ITEMS.map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/30">
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-emerald-100">{item}</span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-emerald-200/60">
          &copy; {new Date().getFullYear()} WhatsApp Commerce OS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
