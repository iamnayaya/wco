'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { fadeUp, staggerContainer, VIEWPORT_ONCE } from '../../lib/utils/animations';

const FAQS = [
  {
    q: 'Do I need to change my WhatsApp number?',
    a: 'No. WCO connects directly to your existing WhatsApp Business number. Your customers see the same number they always have. Nothing changes on their end — everything is just better behind the scenes.',
  },
  {
    q: 'How does the AI auto-responder work?',
    a: 'Our AI is trained on your product catalog, FAQs, and business policies. When a customer messages you, the AI handles the conversation — answering questions, recommending products, taking orders, and even following up on payments. You can review and customize AI responses anytime.',
  },
  {
    q: 'What payment methods do you support?',
    a: 'We support mobile money (MTN MoMo, M-Pesa, Airtel Money), bank transfers, debit/credit cards, and cash on delivery. Payment methods vary by country — we support 8 countries across Africa and South Asia.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes! Our Growth plan comes with a 14-day free trial — no credit card required. You get full access to all Growth features. If you love it, continue with a paid plan. If not, you can stay on our forever-free Starter plan.',
  },
  {
    q: 'Can I use WCO for multiple stores?',
    a: 'Absolutely. Our Enterprise plan supports multi-store management from a single dashboard. Each store gets its own WhatsApp number, product catalog, analytics, and team access. Growth plan supports up to 3 stores.',
  },
  {
    q: 'How secure is my data?',
    a: 'We use bank-grade AES-256 encryption for data at rest and TLS 1.3 for data in transit. Your data is isolated per store — no other seller can ever see your information. We\'re SOC 2 Type II compliant and GDPR-ready.',
  },
  {
    q: 'Do you offer training or onboarding?',
    a: 'Yes! All plans include access to our knowledge base and video tutorials. Growth plan customers get free onboarding calls. Enterprise customers receive a dedicated account manager and custom training sessions.',
  },
  {
    q: 'Can I integrate WCO with my existing tools?',
    a: 'Yes. We offer integrations with popular tools like Google Sheets, Zapier, and custom APIs. Enterprise customers can build custom integrations using our REST API and webhooks.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'You own your data. If you cancel, you can export all your data (customers, orders, products, analytics) in CSV format. We keep your data for 30 days after cancellation, then permanently delete it.',
  },
  {
    q: 'Which countries do you support?',
    a: 'We currently operate in Nigeria, Ghana, Kenya, South Africa, Tanzania, Uganda, India, and Pakistan. We\'re expanding to 15+ countries by end of 2026. Contact us if you need support for your country.',
  },
] as const;

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-slate-900 dark:text-white">{q}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQSection() {
  return (
    <section id="faq" className="relative bg-white py-20 dark:bg-slate-950 lg:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
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
            FAQ
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl"
          >
            Frequently asked questions
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400"
          >
            Everything you need to know about WCO. Can&apos;t find an answer?{' '}
            <a href="#" className="text-emerald-600 hover:underline dark:text-emerald-400">
              Contact our team
            </a>
            .
          </motion.p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="mt-12 divide-y divide-slate-200 dark:divide-slate-700"
        >
          {FAQS.map((faq) => (
            <FAQItem key={faq.q} {...faq} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
