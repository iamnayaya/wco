'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, CloudSun, Calendar } from 'lucide-react';
import { useAuthStore } from '../../store/slices/auth-slice';
import { fadeUp } from '../../lib/utils/animations';

function getGreeting(): { text: string; icon: typeof Sun } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', icon: Sun };
  if (h < 17) return { text: 'Good afternoon', icon: CloudSun };
  return { text: 'Good evening', icon: Moon };
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function WelcomeSection() {
  const user = useAuthStore((s) => s.user);
  const greeting = useMemo(getGreeting, []);
  const GreetingIcon = greeting.icon;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {greeting.text}, {user?.fullName?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate()}
        </p>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <GreetingIcon className="h-8 w-8 text-amber-400" />
      </div>
    </motion.div>
  );
}
