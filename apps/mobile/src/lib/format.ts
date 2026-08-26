/** Shared formatting for mobile — mirrors web lib/utils/format.ts. */
export function formatMoney(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', USD: '$' };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

export function timeAgo(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
