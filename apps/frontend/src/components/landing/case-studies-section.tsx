'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp, Users, Clock } from 'lucide-react';
import { fadeUp, staggerContainer, VIEWPORT_ONCE } from '../../lib/utils/animations';

const CASE_STUDIES = [
  {
    title: 'How Ada\'s Fashion Hub Tripled Revenue in 90 Days',
    excerpt:
      'Adaeze was losing orders in WhatsApp chaos. After switching to WCO, she automated order taking, reduced response time from hours to seconds, and tripled her monthly revenue.',
    metric: '3x Revenue',
    metricDetail: 'from ₦800K to ₦2.4M monthly',
    icon: TrendingUp,
    color: 'from-emerald-500 to-emerald-600',
    image: 'bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-800',
  },
  {
    title: 'TechMarket Ghana: From 20 to 150 Orders Per Week',
    excerpt:
      'Kwame\'s electronics shop struggled with manual order tracking. WCO\'s AI auto-responder and product catalog helped him scale 7x without hiring additional staff.',
    metric: '7x Orders',
    metricDetail: 'with zero additional staff',
    icon: Users,
    color: 'from-blue-500 to-blue-600',
    image: 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800',
  },
  {
    title: 'FreshDirect Kenya: Cutting Customer Churn by 60%',
    excerpt:
      'Fatima was losing customers to competitors. WCO\'s automated follow-ups, loyalty tracking, and smart recommendations helped her retain 85% of customers.',
    metric: '85% Retention',
    metricDetail: 'up from 40% before WCO',
    icon: Clock,
    color: 'from-amber-500 to-amber-600',
    image: 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900 dark:to-amber-800',
  },
] as const;

export default function CaseStudiesSection() {
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
            className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          >
            Success Stories
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
          >
            From struggling to{' '}
            <span className="text-emerald-600 dark:text-emerald-400">thriving</span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400"
          >
            See how real businesses transformed their operations with WCO.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-16 grid gap-8 lg:grid-cols-3"
        >
          {CASE_STUDIES.map((study) => (
            <motion.article
              key={study.title}
              variants={fadeUp}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className={`relative h-48 ${study.image}`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <study.icon className="h-16 w-16 text-white/40" />
                </div>
                <div className="absolute bottom-4 left-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r px-3 py-1 text-sm font-bold text-white shadow-lg ${study.color}`}
                  >
                    {study.metric}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {study.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {study.excerpt}
                </p>
                <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {study.metricDetail}
                </p>
                <Link
                  href="#"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400"
                >
                  Read full case study
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
