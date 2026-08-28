/* eslint-disable @typescript-eslint/no-explicit-any */
import serverless from 'serverless-http';
import { createApp } from '../apps/backend/dist/serverless.js';

console.log('[wco] init: building app');
const app = createApp();
const handler = serverless(app);
console.log('[wco] init: ready');

export default async function handle(req: any, res: any): Promise<void> {
  console.log('[wco] hit', req.method, req.url);
  let watchdog: any = null;
  try {
    const p = (handler as (req: any, res: any) => unknown)(req, res);
    if (p && typeof (p as any).then === 'function') {
      watchdog = setTimeout(() => {
        console.error('[wco] watchdog fired — no response within 15s');
        if (!res.headersSent) res.status(502).json({ error: 'handler exceeded 15s', watchdog: true });
      }, 15_000);
      try {
        const r = await (p as Promise<any>);
        if (r && !res.headersSent) {
          res.status(r.statusCode ?? 200).json(r.body);
        }
      } finally {
        clearTimeout(watchdog);
      }
    }
  } catch (err: any) {
    console.error('[wco] handler threw', err?.message, err?.stack ?? '');
    if (watchdog) clearTimeout(watchdog);
    if (!res.headersSent) {
      res.status(500).json({ error: 'handler threw', message: err?.message });
    }
  }
}