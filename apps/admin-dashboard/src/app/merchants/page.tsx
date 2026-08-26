import { AdminNav } from '../../components/admin-nav';
import { adminApi } from '../../lib/admin-api';

export const dynamic = 'force-dynamic';

interface MerchantRow {
  id: string;
  companyName: string;
  plan: string;
  status: string;
  storesCount: number;
  gmv30d: number;
  createdAt: string;
}

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const page = Number(searchParams?.page ?? '1');
  let data: { items: MerchantRow[]; total: number } | null = null;
  let error: string | null = null;
  try {
    data = await adminApi(`/admin/merchants?page=${page}`);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Backend unavailable';
  }

  return (
    <main>
      <AdminNav />
      <h1 className="mb-4 text-lg font-bold">Merchants</h1>
      {error ? (
        <div className="card border-red-900 text-sm text-red-400">Backend unreachable: {error}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Company</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Stores</th>
                <th className="py-2 pr-4 text-right">GMV 30d</th>
                <th className="py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(data?.items ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-4 font-medium">{m.companyName}</td>
                  <td className="py-2 pr-4 uppercase">{m.plan}</td>
                  <td className={`py-2 pr-4 ${m.status === 'SUSPENDED' ? 'text-red-400' : ''}`}>{m.status}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{m.storesCount}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{Math.round(m.gmv30d).toLocaleString()}</td>
                  <td className="py-2 text-slate-500">{new Date(m.createdAt).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex gap-3 text-xs">
            {page > 1 && <a className="text-emerald-400" href={`/merchants?page=${page - 1}`}>← Prev</a>}
            {data && page * 50 < data.total && (
              <a className="text-emerald-400" href={`/merchants?page=${page + 1}`}>Next →</a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
