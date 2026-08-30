'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, FileText, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui';
import { staggerContainer, VIEWPORT_ONCE } from '../../../lib/utils/animations';
import { useAuthStore } from '../../../store/slices/auth-slice';
import { DateRangeSelector } from '../../../components/analytics/date-range-selector';
import { useGenerateReport } from '../../../components/analytics/hooks';
import {
  presetRange,
  type DateRange,
} from '../../../components/analytics/helpers';
import type { ReportType } from '../../../components/analytics/types';
import {
  OverviewSection,
  SalesSection,
  CustomersSection,
  ProductsSection,
  MessagesSection,
  PaymentsSection,
  DeliveriesSection,
  ReportsSection,
  InsightsSection,
} from '../../../components/analytics/sections';

const TABS: Array<{ id: string; label: string; reportType: ReportType }> = [
  { id: 'overview', label: 'Overview', reportType: 'COMPREHENSIVE' },
  { id: 'sales', label: 'Sales', reportType: 'SALES' },
  { id: 'customers', label: 'Customers', reportType: 'CUSTOMERS' },
  { id: 'products', label: 'Products', reportType: 'PRODUCTS' },
  { id: 'messages', label: 'Messages', reportType: 'MESSAGES' },
  { id: 'payments', label: 'Payments', reportType: 'PAYMENTS' },
  { id: 'deliveries', label: 'Deliveries', reportType: 'DELIVERIES' },
  { id: 'reports', label: 'Reports', reportType: 'COMPREHENSIVE' },
  { id: 'insights', label: 'AI Insights', reportType: 'COMPREHENSIVE' },
];

export default function AnalyticsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'OWNER' || role === 'ADMIN';

  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState<DateRange>({ ...presetRange('30d'), key: '30d', label: '30 days' });
  const [exporting, setExporting] = useState(false);

  const generateReport = useGenerateReport();
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

  async function handleExport() {
    if (!canManage) return;
    setExporting(true);
    try {
      await generateReport.mutateAsync({
        reportType: activeTab.reportType,
        format: 'CSV',
        dateFrom: range.from,
        dateTo: range.to,
      });
    } finally {
      setExporting(false);
    }
  }

  function renderTab() {
    switch (tab) {
      case 'sales':
        return <SalesSection from={range.from} to={range.to} />;
      case 'customers':
        return <CustomersSection from={range.from} to={range.to} />;
      case 'products':
        return <ProductsSection from={range.from} to={range.to} />;
      case 'messages':
        return <MessagesSection from={range.from} to={range.to} />;
      case 'payments':
        return <PaymentsSection from={range.from} to={range.to} />;
      case 'deliveries':
        return <DeliveriesSection from={range.from} to={range.to} />;
      case 'reports':
        return <ReportsSection from={range.from} to={range.to} canManage={canManage} />;
      case 'insights':
        return <InsightsSection from={range.from} to={range.to} canManage={canManage} />;
      case 'overview':
      default:
        return <OverviewSection from={range.from} to={range.to} />;
    }
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      viewport={VIEWPORT_ONCE}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-600" />
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Analytics</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="!px-3 !py-2 text-xs" aria-label="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {canManage && (
            <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => void handleExport()} loading={exporting}>
              <FileText className="h-3.5 w-3.5" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Date range */}
      <DateRangeSelector value={range} onRangeChange={setRange} />

      {/* Tabs */}
      <nav aria-label="Analytics sections" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={
              tab === t.id
                ? 'whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white'
                : 'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      {renderTab()}
    </motion.div>
  );
}
