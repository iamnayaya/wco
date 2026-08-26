'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bot,
  Package,
  CreditCard,
  Truck,
  BarChart3,
  MessageCircle,
  Users,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { fadeUp, staggerContainer, VIEWPORT_ONCE } from '../../lib/utils/animations';

const FEATURES = [
  {
    icon: Bot,
    title: 'AI-Powered Auto-Responder',
    description:
      'Intelligent chatbot that handles customer queries, takes orders, and recommends products — 24/7.',
    tag: 'Most Popular',
  },
  {
    icon: Package,
    title: 'Smart Product Catalog',
    description:
      'Create a beautiful catalog with photos, prices, and descriptions. Share via WhatsApp link or QR code.',
    tag: null,
  },
  {
    icon: CreditCard,
    title: 'Multi-Method Payments',
    description:
      'Accept mobile money, bank transfers, cards, and cash. Auto-reconcile and send receipts instantly.',
    tag: null,
  },
  {
    icon: Truck,
    title: 'Delivery Tracking',
    description:
      'Assign riders, track deliveries live, and auto-notify customers at pickup, transit, and delivery.',
    tag: null,
  },
  {
    icon: BarChart3,
    title: 'Business Analytics',
    description:
      'Real-time dashboards for revenue, orders, customers, and product performance. Know your numbers.',
    tag: null,
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Broadcasts',
    description:
      'Send targeted promotions, order updates, and follow-ups to thousands of customers at once.',
    tag: null,
  },
  {
    icon: Users,
    title: 'Customer Profiles',
    description:
      'Automatic purchase history, preferences, and lifetime value for every customer who messages you.',
    tag: null,
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description:
      'Bank-grade encryption, role-based access, and full data isolation. Your data is yours alone.',
    tag: 'Enterprise',
  },
] as const;

export default function FeaturesSection() {
  return (
    <section id="features" className="relative bg-slate-50 py-20 dark:bg-slate-900 lg:py-28">
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
            Features
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
          >
            Everything you need to{' '}
            <span className="text-emerald-600 dark:text-emerald-400">run & grow</span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400"
          >
            From first message to final delivery — WCO handles the entire commerce lifecycle
            so you can focus on what matters: selling.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeUp}
              className="group relative rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:shadow-xl hover:shadow-emerald-600/5 dark:border-slate-700 dark:bg-slate-800 dark:hover:shadow-emerald-500/5"
            >
              {feature.tag && (
                <span className="absolute right-4 top-4 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  {feature.tag}
                </span>
              )}
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-12 text-center"
        >
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Explore all features
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
