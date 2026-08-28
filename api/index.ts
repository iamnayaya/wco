/* eslint-disable @typescript-eslint/no-explicit-any */
import mod from '../apps/backend/src/serverless.ts';

console.log('[wco] serverless bundle ready', typeof mod);

const theHandler = (mod as any).default ?? mod;

export default async function handler(req: any, res: any): Promise<void> {
  console.log('[wco] hit', req.method, req.url);
  const timeout = setTimeout(() => {
    console.error('[wco] watchdog fired — handler did not finish within 20s');
    if (!res.headersSent) {
      res.status(502).json({ error: 'handler exceeded 20s', watchdog: true });
    }
  }, 20_000);
  try {
    const result = (theHandler as (req: any, res: any) => unknown)(req, res);
    if (result && typeof (result as any).then === 'function') {
      const r = await (result as Promise<any>);
      if (r && !res.headersSent) {
        res.status(r.statusCode ?? 200).json(r.body);
      }
    }
    clearTimeout(timeout);
  } catch (err: any) {
    console.error('[wco] handler threw', err?.message, err?.stack ?? '');
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(500).json({ error: 'handler threw', message: err?.message });
    }
  }
}