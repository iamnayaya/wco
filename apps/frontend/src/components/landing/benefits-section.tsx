'use client';

import { motion } from 'framer-motion';
import { Clock, TrendingUp, HeartHandshake, Brain } from 'lucide-react';
import { fadeUp, staggerContainer, VIEWPORT_ONCE } from '../../lib/utils/animations';

const BENEFITS = [
  {
    icon: Clock,
    title: 'Save 6+ Hours Daily',
    description:
      'Automate order taking, invoicing, payment follow-ups, and delivery updates. Spend time growing, not grinding.',
    metric: '6.2h',
    metricLabel: 'saved per day on average',
  },
  {
    icon: TrendingUp,
    title: '3x More Orders',
    description:
      'Never miss an order again. AI responds instantly, even at 2am. Customers love fast service — they order more.',
    metric: '3.1x',
    metricLabel: 'increase in order volume',
  },
  {
    icon: HeartHandshake,
    title: '85% Customer Retention',
    description:
      'Personalized follow-ups, loyalty rewards, and smart recommendations keep customers coming back.',
    metric: '85%',
    metricLabel: 'customer retention rate',
  },
  {
    icon: Brain,
    title: 'AI Does the Heavy Lifting',
    description:
      'Smart product recommendations, automatic upsells, and intelligent order routing — like having a full team.',
    metric: '24/7',
    metricLabel: 'AI-powered operations',
  },
] as const;

export default function BenefitsSection() {
  return (
    <section className="relative overflow-hidden bg-emerald-600 py-20 dark:bg-emerald-800 lg:py-28">
      <div className="absolute inset-0">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-emerald-700/40 blur-3xl" />
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
            className="inline-block rounded-full bg-emerald-500/30 px-4 py-1.5 text-sm font-semibold text-emerald-100"
          >
            Benefits
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            Real results, real fast
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-2xl text-lg text-emerald-100/80"
          >
            Our sellers don&apos;t just manage their business — they transform it.
            Here&apos;s what WCO delivers.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {BENEFITS.map((benefit) => (
            <motion.div
              key={benefit.title}
              variants={fadeUp}
              className="group rounded-2xl border border-emerald-500/30 bg-white/10 p-6 backdrop-blur-sm transition-all hover:border-emerald-400/50 hover:bg-white/15"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/30">
                <benefit.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">
                {benefit.description}
              </p>
              <div className="mt-4 border-t border-emerald-500/30 pt-4">
                <span className="text-3xl font-bold text-white">{benefit.metric}</span>
                <p className="mt-0.5 text-xs font-medium text-emerald-200/60">
                  {benefit.metricLabel}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
