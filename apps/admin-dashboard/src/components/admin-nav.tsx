import Link from 'next/link';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/merchants', label: 'Merchants' },
  { href: '/incidents', label: 'Incidents' },
] as const;

export default function AdminNav() {
  return (
    <nav className="mb-6 flex gap-4 border-b border-slate-800 pb-3">
      <span className="font-black text-emerald-500">WCO Admin</span>
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} className="text-sm font-medium text-slate-300 hover:text-white">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
