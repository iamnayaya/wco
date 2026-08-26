import { AdminNav } from '../../components/admin-nav';
import { adminApi } from '../../lib/admin-api';

export const dynamic = 'force-dynamic';

interface Incident {
  id: string;
  severity: 'SEV1' | 'SEV2' | 'SEV3';
  component: string;
  summary: string;
  openedAt: string;
  status: string;
}

/**
 * Incidents — read-only view over the ops alert feed.
 * Source of truth stays PagerDuty/Opsgenie; this is the "what's on fire" tile.
 */
export default async function IncidentsPage() {
  let incidents: Incident[] = [];
  let error: string | null = null;
  try {
    const data = await adminApi<{ items: Incident[] }>('/admin/incidents');
    incidents = data.items;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Backend unavailable';
  }

  return (
    <main>
      <AdminNav />
      <h1 className="mb-4 text-lg font-bold">Incidents</h1>
      {error ? (
        <div className="card border-red-900 text-sm text-red-400">Feed unavailable: {error}</div>
      ) : incidents.length === 0 ? (
        <div className="card text-sm text-slate-500">No open incidents. Enjoy it while it lasts.</div>
      ) : (
        <ul className="space-y-2">
          {incidents.map((incident) => (
            <li
              key={incident.id}
              className={`card ${incident.severity === 'SEV1' ? 'border-red-800' : incident.severity === 'SEV2' ? 'border-amber-800' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">
                  [{incident.severity}] {incident.component}: {incident.summary}
                </p>
                <span className="shrink-0 text-xs text-slate-500">
                  {new Date(incident.openedAt).toISOString()} · {incident.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
