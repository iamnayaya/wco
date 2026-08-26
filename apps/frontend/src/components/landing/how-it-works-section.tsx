'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Smartphone, Settings, Rocket } from 'lucide-react';
import { fadeUp, staggerContainer, slideInLeft, slideInRight, VIEWPORT_ONCE } from '../../lib/utils/animations';

const STEPS = [
  {
    number: '01',
    icon: Smartphone,
    title: 'Connect Your WhatsApp',
    description:
      'Link your existing WhatsApp Business number in under 2 minutes. No app to install, no number to change.',
    details: [
      'One-click WhatsApp Business API connection',
      'Keep your existing phone number',
      'Works with your current customers',
    ],
  },
  {
    number: '02',
    icon: Settings,
    title: 'Set Up Your Store',
    description:
      'Add your products, set prices, configure payment methods, and set delivery zones. Our AI helps you along the way.',
    details: [
      'AI-assisted product catalog setup',
      'Mobile money, bank, and cash payments',
      'Custom delivery zones and pricing',
    ],
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Start Selling & Growing',
    description:
      'Your AI assistant starts handling orders immediately. Watch your dashboard light up with real-time insights.',
    details: [
      'AI auto-responds to every customer',
      'Real-time order and payment tracking',
      'Growth analytics from day one',
    ],
  },
] as const;

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative bg-white py-20 dark:bg-slate-950 lg:py-28"
    >
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
            How It Works
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
          >
            Up and running in{' '}
            <span className="text-emerald-600 dark:text-emerald-400">3 simple steps</span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400"
          >
            No technical skills needed. If you can use WhatsApp, you can use WCO.
          </motion.p>
        </motion.div>

        <div className="mt-20 space-y-16 lg:space-y-24">
          {STEPS.map((step, index) => (
            <motion.div
              key={step.number}
              variants={index % 2 === 0 ? slideInLeft : slideInRight}
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT_ONCE}
              className={`flex flex-col items-center gap-10 lg:flex-row ${
                index % 2 !== 0 ? 'lg:flex-row-reverse' : ''
              }`}
            >
              <div className="flex-1 space-y-6">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    {step.number}
                  </span>
                  <step.icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
                  {step.description}
                </p>
                <ul className="space-y-2">
                  {step.details.map((detail) => (
                    <li
                      key={detail}
                      className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                        <svg
                          className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex-1">
                <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex aspect-video items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-800">
                    <step.icon className="h-16 w-16 text-emerald-200 dark:text-emerald-800" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-16 text-center"
        >
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-xl active:scale-[0.98]"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
