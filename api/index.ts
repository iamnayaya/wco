/* eslint-disable @typescript-eslint/no-explicit-any */
let handlerPromise: Promise<unknown> | null = null;

function loadHandler(): Promise<unknown> {
  if (!handlerPromise) {
    console.log('[wco] loading serverless bundle');
    handlerPromise = import(/* webpackIgnore: true */ '../apps/backend/dist/serverless.js')
      .then((mod) => {
        const h = (mod as any).default ?? mod;
        console.log('[wco] serverless bundle ready', typeof h);
        return h;
      })
      .catch((err: any) => {
        console.error('[wco] bundle load failed', err?.message, err?.stack ?? '');
        handlerPromise = null;
        throw err;
      });
  }
  return handlerPromise;
}

export default async function handler(req: any, res: any): Promise<void> {
  console.log('[wco] hit', req.method, req.url);
  try {
    const h = await loadHandler();
    const timeout = setTimeout(() => {
      console.error('[wco] watchdog fired — handler did not finish within 20s');
      if (!res.headersSent) {
        res.status(502).json({ error: 'handler exceeded 20s', watchdog: true });
      }
    }, 20_000);
    try {
      const result = (h as (req: any, res: any) => unknown)(req, res);
      if (result && typeof (result as any).then === 'function') {
        const r = await (result as Promise<any>);
        if (r && !res.headersSent) {
          res.status(r.statusCode ?? 200).json(r.body);
        }
      }
      clearTimeout(timeout);
    } catch (err: any) {
      console.error('[wco] handler threw', err?.message);
      clearTimeout(timeout);
      if (!res.headersSent) {
        res.status(500).json({ error: 'handler threw', message: err?.message });
      }
    }
  } catch (err: any) {
    console.error('[wco] shared service load failed', err?.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'serverless bundle failed to load', message: err?.message });
    }
  }
}