/* eslint-disable @typescript-eslint/no-explicit-any */
let loadError: string | undefined;
let theHandler: unknown;

try {
  const mod = require('../apps/backend/dist/serverless.js') as any;
  theHandler = mod.default ?? mod;
  console.log('[wco] serverless bundle ready', typeof theHandler);
} catch (err: any) {
  loadError = `${err?.message ?? err}${err?.stack ? `\n${err.stack}` : ''}`;
  console.error('[wco] serverless bundle init failed', loadError);
}

export default async function handler(req: any, res: any): Promise<void> {
  console.log('[wco] hit', req.method, req.url);
  if (!theHandler) {
    res.status(500).json({ error: 'serverless bundle failed to initialize', loadError });
    return;
  }
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