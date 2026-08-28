'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  useDashboardMetrics,
  useDashboardOrders,
  useDashboardProducts,
  useDashboardMessages,
  useDashboardTasks,
  useDashboardInsights,
} from '../../../hooks/use-dashboard';
import {
  WelcomeSection,
  MetricsCards,
  SalesChart,
  RecentOrders,
  TopProducts,
  RecentMessages,
  TasksReminders,
  AIInsights,
  QuickActions,
} from '../../../components/dashboard';
import { staggerContainer, VIEWPORT_ONCE } from '../../../lib/utils/animations';

export default function DashboardPage() {
  const metrics = useDashboardMetrics();
  const orders = useDashboardOrders();
  const products = useDashboardProducts();
  const messages = useDashboardMessages();
  const tasks = useDashboardTasks();
  const insights = useDashboardInsights();

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-8"
    >
      {/* Welcome */}
      <WelcomeSection />

      {/* Quick Actions */}
      <QuickActions />

      {/* Key Metrics */}
      <MetricsCards data={metrics.data} />

      {/* Charts + Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChart data={metrics.data} />
        </div>
        <div className="space-y-6">
          <AIInsights insights={insights.data} isLoading={insights.isLoading} />
        </div>
      </div>

      {/* Orders + Products */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentOrders orders={orders.data} isLoading={orders.isLoading} />
        <TopProducts products={products.data} isLoading={products.isLoading} />
      </div>

      {/* Messages + Tasks */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentMessages messages={messages.data} isLoading={messages.isLoading} />
        <TasksReminders tasks={tasks.data} isLoading={tasks.isLoading} />
      </div>
    </motion.div>
  );
}
