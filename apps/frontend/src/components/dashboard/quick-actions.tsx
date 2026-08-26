'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Plus,
  ShoppingCart,
  MessageSquare,
  BarChart3,
  Megaphone,
  Package,
} from 'lucide-react';
import { fadeUp } from '../../lib/utils/animations';

const ACTIONS = [
  { label: 'Add Product', href: '/products', icon: Package, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  { label: 'New Order', href: '/orders', icon: ShoppingCart, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { label: 'Send Message', href: '/conversations', icon: MessageSquare, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' },
  { label: 'View Analytics', href: '/analytics', icon: BarChart3, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  { label: 'Campaign', href: '/marketing', icon: Megaphone, color: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300' },
] as const;

export function QuickActions() {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Quick Actions</h3>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600"
          >
            <div className={`flex h-6 w-6 items-center justify-center rounded-md ${action.color}`}>
              <action.icon className="h-3.5 w-3.5" />
            </div>
            {action.label}
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
