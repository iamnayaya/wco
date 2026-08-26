'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, Zap } from 'lucide-react';
import { fadeUp, staggerContainer, VIEWPORT_ONCE } from '../../lib/utils/animations';

const PLANS = [
  {
    name: 'Starter',
    description: 'Perfect for solo traders just getting started.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: 'Start Free',
    popular: false,
    features: [
      'Up to 50 orders/month',
      '1 WhatsApp number',
      'Basic product catalog',
      'Payment tracking',
      'Email support',
      'Basic analytics',
    ],
  },
  {
    name: 'Growth',
    description: 'For growing businesses ready to scale.',
    monthlyPrice: 29,
    yearlyPrice: 24,
    cta: 'Start 14-Day Trial',
    popular: true,
    features: [
      'Unlimited orders',
      '3 WhatsApp numbers',
      'AI auto-responder',
      'Smart product catalog',
      'Multi-method payments',
      'Delivery tracking',
      'Advanced analytics',
      'WhatsApp broadcasts',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    description: 'For established businesses and teams.',
    monthlyPrice: 99,
    yearlyPrice: 79,
    cta: 'Contact Sales',
    popular: false,
    features: [
      'Everything in Growth',
      'Unlimited WhatsApp numbers',
      'Custom AI training',
      'Multi-store management',
      'Team access (10+ users)',
      'API access',
      'Custom integrations',
      'Dedicated account manager',
      '99.99% SLA',
      'SSO & advanced security',
    ],
  },
] as const;

export default function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative bg-slate-50 py-20 dark:bg-slate-900 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="text-center"
        >
          <motion.span
            variants={fadeUp}
            className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          >
            Pricing
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
          >
            Simple, transparent pricing
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400"
          >
            Start free. Upgrade when you&apos;re ready. No hidden fees, no surprises.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-3">
            <span
              className={`text-sm font-medium ${
                !annual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Monthly
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                annual ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
              aria-label={`Switch to ${annual ? 'monthly' : 'annual'} billing`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                  annual ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium ${
                annual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Annual
            </span>
            {annual && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                Save 18%
              </span>
            )}
          </motion.div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-12 grid gap-8 lg:grid-cols-3"
        >
          {PLANS.map((plan) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              className={`relative flex flex-col rounded-2xl border p-8 transition-all ${
                plan.popular
                  ? 'border-emerald-300 bg-white shadow-xl shadow-emerald-600/10 dark:border-emerald-700 dark:bg-slate-800'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                    <Zap className="h-3 w-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {plan.description}
                </p>
              </div>

              <div className="mt-6">
                {plan.monthlyPrice === 0 ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">Free</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">forever</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">
                      ${annual ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">/mo</span>
                  </div>
                )}
                {annual && plan.monthlyPrice > 0 && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Billed ${plan.yearlyPrice * 12}/year
                  </p>
                )}
              </div>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`mt-8 block rounded-xl px-6 py-3 text-center text-sm font-semibold transition-all ${
                  plan.popular
                    ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow-md active:scale-[0.98]'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400"
        >
          All paid plans include a 14-day free trial. No credit card required.
          Cancel anytime. Need a custom plan?{' '}
          <Link href="#" className="text-emerald-600 hover:underline dark:text-emerald-400">
            Contact sales
          </Link>
          .
        </motion.p>
      </div>
    </section>
  );
}
