import { AdminNav } from '../components/admin-nav';
import { adminApi } from '../lib/admin-api';

export const dynamic = 'force-dynamic';

interface OpsOverview {
  merchants: { total: number; active7d: number; trial: number };
  gmv: { today: number; week: number; currency: string };
  platform: { orders24h: number; messages24h: number; aiResolutionRate: number };
  queue: { outboxLag: number; dlqDepth: number; webhookFailures1h: number };
}

export default async function OverviewPage() {
  let data: OpsOverview | null = null;
  let error: string | null = null;
  try {
    data = await adminApi<OpsOverview>('/admin/overview');
  } catch (e) {
    error = e instanceof Error ? e.message : 'Backend unavailable';
  }

  return (
    <main>
      <AdminNav />
      <h1 className="mb-4 text-lg font-bold">Platform overview</h1>
      {error ? (
        <div className="card border-red-900 text-sm text-red-400">
          Backend unreachable: {error}
        </div>
      ) : !data ? (
        <div className="card text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric label="Merchants" value={String(data.merchants.total)} sub={`${data.merchants.active7d} active 7d · ${data.merchants.trial} on trial`} />
          <Metric label={`GMV today (${data.gmv.currency})`} value={data.gmv.today.toLocaleString()} sub={`Week: ${data.gmv.week.toLocaleString()}`} />
          <Metric label="Orders 24h" value={String(data.platform.orders24h)} sub={`${data.platform.messages24h.toLocaleString()} messages`} />
          <Metric
            label="AI resolution"
            value={`${Math.round(data.platform.aiResolutionRate * 100)}%`}
            sub={`Outbox lag ${data.queue.outboxLag}s · DLQ ${data.queue.dlqDepth}`}
            alert={data.queue.dlqDepth > 0 || data.queue.outboxLag > 30}
          />
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={`card ${alert ? 'border-red-800' : ''}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
