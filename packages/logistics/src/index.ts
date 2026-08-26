import { GIGProvider } from './providers/gig.provider';
import { KwikProvider } from './providers/kwik.provider';
import { SendyProvider } from './providers/sendy.provider';
import type { LogisticsProvider } from './logistics-provider.interface';

export * from './logistics-provider.interface';
export * from './tracking';
export { GIGProvider } from './providers/gig.provider';
export { KwikProvider } from './providers/kwik.provider';
export { SendyProvider } from './providers/sendy.provider';

/**
 * Build the configured carrier set. `isConfigured()` lets the quoting
 * service degrade gracefully — a merchant in Nairobi gets GIG filtered out.
 */
export function buildLogisticsProviders(): Record<string, LogisticsProvider> {
  const providers: LogisticsProvider[] = [
    new GIGProvider(process.env.GIG_API_KEY, process.env.GIG_BASE_URL),
    new KwikProvider(process.env.KWIK_API_KEY, process.env.KWIK_BASE_URL),
    new SendyProvider(process.env.SENDY_API_KEY, process.env.SENDY_BASE_URL),
  ];

  return Object.fromEntries(providers.map((p) => [p.carrier, p]));
}
