'use client';

import { useState } from 'react';
import { Clock, Download, FileText, RefreshCw, X } from 'lucide-react';
import { Badge, Button, EmptyState, Field, Spinner } from '../../../components/ui';
import { Modal } from '../../../components/ui/modal';
import { FREQUENCY_LABEL } from '../helpers';
import {
  REPORT_STATUS_LABEL,
  REPORT_TYPE_LABEL,
  REPORT_TYPES,
  FREQUENCIES,
  FORMATS,
} from '../helpers';
import {
  useCancelScheduledReport,
  useGenerateReport,
  useReportsList,
  useScheduleReport,
} from '../hooks';
import type { ReportFrequency, ReportFormat, ReportType } from '../types';

export function ReportsSection({ from, to, canManage }: { from: string; to: string; canManage: boolean }) {
  const { data, isLoading } = useReportsList({ pageSize: 50 });
  const generate = useGenerateReport();
  const schedule = useScheduleReport();
  const cancel = useCancelScheduledReport();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [type, setType] = useState<ReportType>('SALES');
  const [format, setFormat] = useState<ReportFormat>('CSV');
  const [frequency, setFrequency] = useState<ReportFrequency>('WEEKLY');

  function reset() {
    setType('SALES');
    setFormat('CSV');
    setFrequency('WEEKLY');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Reports &amp; exports</h3>
          <p className="mt-0.5 text-xs text-slate-500">Generate on-demand reports or schedule recurring exports.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { reset(); setGenerateOpen(true); }}>
              <FileText className="h-4 w-4" /> Generate
            </Button>
            <Button variant="secondary" onClick={() => { reset(); setScheduleOpen(true); }}>
              <Clock className="h-4 w-4" /> Schedule
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !data?.items.length ? (
        <EmptyState
          title="No reports yet"
          description="Generate or schedule a report to start exporting analytics."
          action={canManage ? (
            <Button onClick={() => { reset(); setGenerateOpen(true); }}>
              <FileText className="h-4 w-4" /> Generate a report
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Format</th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell">Frequency</th>
                  <th className="hidden px-4 py-2 font-medium lg:table-cell">Period</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.items.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{REPORT_TYPE_LABEL[report.reportType]}</td>
                    <td className="px-4 py-2.5"><Badge label={REPORT_STATUS_LABEL[report.status]} tone="PROCESSING" /></td>
                    <td className="hidden px-4 py-2.5 text-slate-600 sm:table-cell">{report.format}</td>
                    <td className="hidden px-4 py-2.5 text-slate-600 md:table-cell">{FREQUENCY_LABEL[report.frequency]}</td>
                    <td className="hidden px-4 py-2.5 text-xs text-slate-500 lg:table-cell">{period(report.dateFrom, report.dateTo)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {report.status === 'COMPLETED' && canManage && (
                          <Button variant="ghost" aria-label="Download report">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {report.frequency !== 'ONCE' && canManage && (
                          <Button variant="ghost" aria-label="Cancel schedule" onClick={() => cancel.mutate(report.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        {(report.status === 'GENERATING' || report.status === 'PENDING') && (
                          <RefreshCw className="h-4 w-4 animate-spin text-slate-400" aria-label="Generating" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <GenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        type={type}
        setType={setType}
        format={format}
        setFormat={setFormat}
        from={from}
        to={to}
        busy={generate.isPending}
        onSubmit={(t, f) => generate.mutateAsync({ reportType: t, format: f, dateFrom: from, dateTo: to }).then(() => setGenerateOpen(false))}
      />
      <ScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        type={type}
        setType={setType}
        format={format}
        setFormat={setFormat}
        frequency={frequency}
        setFrequency={setFrequency}
        busy={schedule.isPending}
        onSubmit={(t, f, freq) => schedule.mutateAsync({ reportType: t, format: f, frequency: freq }).then(() => setScheduleOpen(false))}
      />
    </div>
  );
}

function period(from: string, to: string): string {
  try {
    return `${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}`;
  } catch {
    return '';
  }
}

// ─── Modals ──────────────────────────────────────────────────────

function GenerateModal({ open, onClose, type, setType, format, setFormat, from, to, busy, onSubmit }: {
  open: boolean;
  onClose: () => void;
  type: ReportType;
  setType: (t: ReportType) => void;
  format: ReportFormat;
  setFormat: (f: ReportFormat) => void;
  from: string;
  to: string;
  busy: boolean;
  onSubmit: (type: ReportType, format: ReportFormat) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Generate report" size="md">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(type, format); }}>
        <Field label="Report type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
            {REPORT_TYPES.map((t) => <option key={t} value={t}>{REPORT_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Format">
          <select className="input" value={format} onChange={(e) => setFormat(e.target.value as ReportFormat)}>
            {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <p className="text-xs text-slate-500">Period: {period(from, to)}</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}><FileText className="h-4 w-4" /> Generate</Button>
        </div>
      </form>
    </Modal>
  );
}

function ScheduleModal({ open, onClose, type, setType, format, setFormat, frequency, setFrequency, busy, onSubmit }: {
  open: boolean;
  onClose: () => void;
  type: ReportType;
  setType: (t: ReportType) => void;
  format: ReportFormat;
  setFormat: (f: ReportFormat) => void;
  frequency: ReportFrequency;
  setFrequency: (f: ReportFrequency) => void;
  busy: boolean;
  onSubmit: (type: ReportType, format: ReportFormat, frequency: ReportFrequency) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Schedule report" size="md">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(type, format, frequency); }}>
        <Field label="Report type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
            {REPORT_TYPES.map((t) => <option key={t} value={t}>{REPORT_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Frequency">
            <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as ReportFrequency)}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
            </select>
          </Field>
          <Field label="Format">
            <select className="input" value={format} onChange={(e) => setFormat(e.target.value as ReportFormat)}>
              {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}><Clock className="h-4 w-4" /> Schedule</Button>
        </div>
      </form>
    </Modal>
  );
}
