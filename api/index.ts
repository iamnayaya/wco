/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApp } from '../apps/backend/dist/serverless.js';

/** Vercel Node runtime function timeout — matches the in-handler watchdog. */
export const maxDuration = 60;

console.log('[wco] init: building app');
const app = createApp();
console.log('[wco] init: ready');

export default function handle(req: any, res: any): void {
  console.log('[wco] hit', req.method, req.url, req.originalUrl ?? '');
  const watchdog = setTimeout(() => {
    console.error('[wco] watchdog fired — no response within 60s');
    if (!res.headersSent) res.status(502).json({ error: 'handler exceeded 60s', watchdog: true });
  }, 60_000);
  res.on('finish', () => {
    clearTimeout(watchdog);
    console.error('[wco] done', res.statusCode);
  });
  try {
    app(req, res);
  } catch (err: any) {
    console.error('[wco] handler threw', err?.message, err?.stack ?? '');
    clearTimeout(watchdog);
    if (!res.headersSent) {
      res.status(500).json({ error: 'handler threw', message: err?.message });
    }
  }
}