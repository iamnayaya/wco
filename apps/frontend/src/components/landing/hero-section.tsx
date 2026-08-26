'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Shield, Zap, Globe, Users } from 'lucide-react';
import { fadeUp, staggerContainer, VIEWPORT_ONCE } from '../../lib/utils/animations';

const TRUST_STATS = [
  { icon: Users, value: '12,000+', label: 'Active Sellers' },
  { icon: Globe, value: '8', label: 'Countries' },
  { icon: Zap, value: '2.4M+', label: 'Orders Processed' },
  { icon: Shield, value: '99.9%', label: 'Uptime SLA' },
] as const;

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/80 via-white to-white pt-24 pb-16 dark:from-emerald-950/20 dark:via-slate-950 dark:to-slate-950 lg:pt-32 lg:pb-24">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-800/10" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-emerald-100/50 blur-3xl dark:bg-emerald-900/10" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          viewport={VIEWPORT_ONCE}
          className="text-center"
        >
          <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <Zap className="h-3.5 w-3.5" />
            AI-Powered Commerce for WhatsApp
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl"
          >
            Turn Your WhatsApp Into a{' '}
            <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
              Money-Making Machine
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400 sm:text-xl"
          >
            The all-in-one operating system for informal traders. Manage products, orders,
            payments, and deliveries — all from WhatsApp. Powered by AI that works while you sleep.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-[0.98]"
            >
              Start Free for 14 Days
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
              <Play className="h-4 w-4 fill-current" />
              Watch Demo
            </button>
          </motion.div>

          <motion.p variants={fadeUp} className="mt-4 text-sm text-slate-500 dark:text-slate-500">
            No credit card required · Free 14-day trial · Cancel anytime
          </motion.p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="relative mx-auto mt-16 max-w-4xl"
        >
          <div className="relative rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="rounded-xl bg-slate-100 dark:bg-slate-800">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
                <div className="ml-4 flex-1 rounded-lg bg-white px-3 py-1 text-xs text-slate-400 dark:bg-slate-900">
                  app.whatsappcommerce.com/dashboard
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 p-6">
                <div className="space-y-3">
                  <div className="h-8 w-full rounded-lg bg-emerald-100 dark:bg-emerald-900/30" />
                  <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-20 w-full rounded-lg bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="col-span-2 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-16 rounded-lg bg-emerald-50 dark:bg-emerald-900/20" />
                    <div className="h-16 rounded-lg bg-blue-50 dark:bg-blue-900/20" />
                    <div className="h-16 rounded-lg bg-amber-50 dark:bg-amber-900/20" />
                  </div>
                  <div className="h-32 w-full rounded-lg bg-slate-200 dark:bg-slate-700" />
                  <div className="flex gap-3">
                    <div className="h-8 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-8 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-b from-emerald-500/10 to-transparent blur-2xl dark:from-emerald-500/5" />
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {TRUST_STATS.map((stat) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              className="flex flex-col items-center rounded-xl border border-slate-200 bg-white/60 px-4 py-5 text-center backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/60"
            >
              <stat.icon className="mb-2 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</span>
              <span className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
