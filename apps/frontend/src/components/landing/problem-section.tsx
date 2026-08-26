'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Clock,
  Calculator,
  TrendingDown,
} from 'lucide-react';
import { fadeUp, staggerContainer, VIEWPORT_ONCE } from '../../lib/utils/animations';

const PROBLEMS = [
  {
    icon: AlertTriangle,
    title: 'WhatsApp Chaos',
    description:
      'Orders buried in chat threads. Messages lost. Customers waiting for hours. Sound familiar?',
    stat: '73%',
    statLabel: 'of sellers lose orders via chat',
  },
  {
    icon: Clock,
    title: 'No Time to Scale',
    description:
      'Spending 6+ hours daily on manual order tracking, invoicing, and chasing payments instead of growing.',
    stat: '6.2h',
    statLabel: 'avg. daily time on admin tasks',
  },
  {
    icon: Calculator,
    title: 'Zero Financial Visibility',
    description:
      'No idea which products are profitable. Tracking expenses on paper. Tax season is a nightmare.',
    stat: '89%',
    statLabel: 'have no financial dashboards',
  },
  {
    icon: TrendingDown,
    title: 'Customers Disappear',
    description:
      'No follow-ups, no marketing, no way to keep customers coming back. Revenue stays flat year after year.',
    stat: '45%',
    statLabel: 'customer churn without systems',
  },
] as const;

export default function ProblemSection() {
  return (
    <section className="relative bg-white py-20 dark:bg-slate-950 lg:py-28">
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
            className="inline-block rounded-full bg-red-50 px-4 py-1.5 text-sm font-semibold text-red-600 dark:bg-red-950 dark:text-red-400"
          >
            The Problem
          </motion.span>

          <motion.h2
            variants={fadeUp}
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
          >
            Running a WhatsApp business{' '}
            <span className="text-red-500">shouldn&apos;t feel this hard</span>
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400"
          >
            Millions of traders across Africa and Asia are losing money, time, and customers
            because they don&apos;t have the right tools. Sound like you?
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {PROBLEMS.map((problem) => (
            <motion.div
              key={problem.title}
              variants={fadeUp}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-red-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-red-800/40"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-colors group-hover:bg-red-100 dark:bg-red-950 dark:text-red-400">
                <problem.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {problem.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {problem.description}
              </p>
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <span className="text-2xl font-bold text-red-500">{problem.stat}</span>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-500">
                  {problem.statLabel}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
