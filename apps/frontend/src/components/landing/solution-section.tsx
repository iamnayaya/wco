'use client';

import { motion } from 'framer-motion';
import {
  Bot,
  Package,
  CreditCard,
  Truck,
  BarChart3,
  MessageCircle,
} from 'lucide-react';
import { fadeUp, staggerContainer, VIEWPORT_ONCE } from '../../lib/utils/animations';

const SOLUTIONS = [
  {
    icon: Bot,
    title: 'AI Auto-Responder',
    description: 'Your AI assistant replies to customers 24/7 — handling FAQs, taking orders, and upselling.',
  },
  {
    icon: Package,
    title: 'Product Catalog',
    description: 'Beautiful product catalog shared directly in WhatsApp. Customers browse and order without leaving chat.',
  },
  {
    icon: CreditCard,
    title: 'Payment Tracking',
    description: 'Automated payment reminders, multi-method support (mobile money, bank, cash), real-time reconciliation.',
  },
  {
    icon: Truck,
    title: 'Delivery Management',
    description: 'Assign riders, track deliveries in real-time, and auto-notify customers at every step.',
  },
  {
    icon: BarChart3,
    title: 'Business Analytics',
    description: 'Know your best sellers, busiest hours, and profit margins — all in one beautiful dashboard.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Native',
    description: 'No new app to learn. Works directly inside the WhatsApp your customers already use and love.',
  },
] as const;

export default function SolutionSection() {
  return (
    <section
      id="solution"
      className="relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/40 to-white py-20 dark:from-slate-950 dark:via-emerald-950/10 dark:to-slate-950 lg:py-28"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-200/20 blur-3xl dark:bg-emerald-800/10" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
            The Solution
          </motion.span>

          <motion.h2
            variants={fadeUp}
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
          >
            Meet WhatsApp Commerce OS
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400"
          >
            One powerful platform that turns your WhatsApp into a full-scale commerce engine.
            Manage everything from a single dashboard — or never leave WhatsApp at all.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SOLUTIONS.map((solution) => (
            <motion.div
              key={solution.title}
              variants={fadeUp}
              className="group relative rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-600/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700/40"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400">
                <solution.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {solution.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {solution.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
