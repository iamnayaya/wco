'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { useAuthStore } from '../../../store/slices/auth-slice';
import { Toaster } from '../../../components/ui/toaster';
import {
  AccountTab,
  WhatsAppTab,
  BusinessTab,
  PaymentTab,
  DeliveryTab,
  AiTab,
  NotificationsTab,
  TeamTab,
  SubscriptionTab,
  IntegrationsTab,
  SettingsLayout,
  type SettingsTab,
} from '../../../components/settings';

export default function SettingsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === 'OWNER';
  const [tab, setTab] = useState<SettingsTab>('account');

  function renderTab() {
    switch (tab) {
      case 'whatsapp':
        return <WhatsAppTab />;
      case 'business':
        return <BusinessTab />;
      case 'payment':
        return <PaymentTab />;
      case 'delivery':
        return <DeliveryTab />;
      case 'ai':
        return <AiTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'team':
        return <TeamTab />;
      case 'subscription':
        return <SubscriptionTab />;
      case 'integrations':
        return <IntegrationsTab />;
      case 'account':
      default:
        return <AccountTab />;
    }
  }

  const header = (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-emerald-600" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Settings</h1>
        <span className="text-sm text-slate-400">/</span>
        <span className="text-sm text-slate-500 capitalize">{tab}</span>
      </div>
    </motion.div>
  );

  return (
    <>
      <Toaster />
      <SettingsLayout active={tab} onSelect={setTab} isOwner={isOwner} header={header}>
        {renderTab()}
      </SettingsLayout>
    </>
  );
}
