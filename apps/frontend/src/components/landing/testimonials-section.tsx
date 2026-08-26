'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { fadeUp, staggerContainer, VIEWPORT_ONCE } from '../../lib/utils/animations';

const TESTIMONIALS = [
  {
    text: "WCO completely changed how I run my business. I used to lose orders in WhatsApp chats. Now I process 3x more orders in half the time. The AI handles everything while I sleep.",
    name: 'Adaeze Okonkwo',
    title: 'Owner, Ada\'s Fashion Hub',
    location: 'Lagos, Nigeria',
    rating: 5,
    color: 'bg-emerald-100 dark:bg-emerald-900',
    initials: 'AO',
  },
  {
    text: "I went from 20 orders a week to 150. The AI auto-responder is incredible — my customers think they're talking to a real person. Best investment I've made for my business.",
    name: 'Kwame Asante',
    title: 'Founder, TechMarket Ghana',
    location: 'Accra, Ghana',
    rating: 5,
    color: 'bg-blue-100 dark:bg-blue-900',
    initials: 'KA',
  },
  {
    text: "Before WCO, I had no idea which products were actually profitable. Now I see everything in real-time. I cut my losses on 3 products and doubled my revenue in 2 months.",
    name: 'Fatima Hassan',
    title: 'CEO, FreshDirect Kenya',
    location: 'Nairobi, Kenya',
    rating: 5,
    color: 'bg-amber-100 dark:bg-amber-900',
    initials: 'FH',
  },
  {
    text: "The delivery tracking feature alone is worth the price. My customers get automatic updates and my riders know exactly where to go. Complaints dropped by 90%.",
    name: 'Thabo Molefe',
    title: 'Director, DeliveryPro SA',
    location: 'Johannesburg, South Africa',
    rating: 5,
    color: 'bg-purple-100 dark:bg-purple-900',
    initials: 'TM',
  },
  {
    text: "I set up WCO in 10 minutes and started getting orders immediately. The product catalog feature is beautiful — my customers love browsing and ordering from WhatsApp.",
    name: 'Priya Sharma',
    title: 'Owner, Spice Route Online',
    location: 'Mumbai, India',
    rating: 5,
    color: 'bg-rose-100 dark:bg-rose-900',
    initials: 'PS',
  },
  {
    text: "We manage 500+ orders daily with a team of just 3 people. Before WCO, we needed 15. The automation is insane. Best ROI of any tool we've ever used.",
    name: 'Oluwaseun Adeyemi',
    title: 'COO, BulkBuy Nigeria',
    location: 'Abuja, Nigeria',
    rating: 5,
    color: 'bg-emerald-100 dark:bg-emerald-900',
    initials: 'OA',
  },
  {
    text: "The analytics dashboard gives me insights I never had before. I know my busiest hours, best customers, and top products. It's like having a business consultant on call.",
    name: 'Grace Mwangi',
    title: 'Founder, Grace Electronics',
    location: 'Mombasa, Kenya',
    rating: 5,
    color: 'bg-cyan-100 dark:bg-cyan-900',
    initials: 'GM',
  },
  {
    text: "Switching to WCO was the best decision for my business. The payment tracking alone saved me hours of reconciliation. My customers love the instant receipts.",
    name: 'Emeka Obi',
    title: 'Owner, Obi\'s Electronics',
    location: 'Port Harcourt, Nigeria',
    rating: 5,
    color: 'bg-orange-100 dark:bg-orange-900',
    initials: 'EO',
  },
] as const;

const ITEMS_PER_PAGE = 3;

export default function TestimonialsSection() {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(TESTIMONIALS.length / ITEMS_PER_PAGE);
  const visible = TESTIMONIALS.slice(
    page * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE + ITEMS_PER_PAGE,
  );

  return (
    <section id="testimonials" className="relative bg-slate-50 py-20 dark:bg-slate-900 lg:py-28">
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
            Testimonials
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
          >
            Loved by{' '}
            <span className="text-emerald-600 dark:text-emerald-400">12,000+ sellers</span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400"
          >
            Don&apos;t take our word for it. Here&apos;s what real traders say about WCO.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-16 grid gap-6 md:grid-cols-3"
        >
          {visible.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
            >
              <Quote className="mb-3 h-8 w-8 text-emerald-200 dark:text-emerald-800" />
              <p className="flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-1">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-slate-700 dark:text-slate-300 ${t.color}`}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.title} · {t.location}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Previous testimonials"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Next testimonials"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
