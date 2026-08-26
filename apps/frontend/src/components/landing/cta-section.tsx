'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, CreditCard } from 'lucide-react';
import { fadeUp, staggerContainer, VIEWPORT_ONCE } from '../../lib/utils/animations';

export default function CTASection() {
  return (
    <section className="relative overflow-hidden bg-slate-900 py-20 dark:bg-slate-950 lg:py-28">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
        >
          <motion.h2
            variants={fadeUp}
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            Ready to transform your{' '}
            <span className="text-emerald-400">WhatsApp business</span>?
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-lg text-slate-400"
          >
            Join 12,000+ sellers across 8 countries who are already using WCO to automate,
            manage, and grow their WhatsApp businesses. Start free today.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-500 hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.98]"
            >
              Start Your Free Trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-8 py-4 text-base font-semibold text-slate-300 transition-all hover:border-slate-500 hover:text-white"
            >
              Talk to Sales
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500"
          >
            <span className="flex items-center gap-1.5">
              <CreditCard className="h-4 w-4" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              14-day free trial
            </span>
            <span>Cancel anytime</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
