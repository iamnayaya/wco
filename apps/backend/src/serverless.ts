import serverless from 'serverless-http';

import { createApp } from './app.js';

/**
 * Serverless entry point (Vercel / AWS Lambda style handlers).
 *
 * The HTTP listener + graceful-shutdown rig in main.ts belongs to the
 * long-running Node process; on serverless platforms we hand the same
 * Express app to the platform's lambda adapter instead. Env config still
 * validates at import time, and Redis/RabbitMQ/queue dependencies all
 * degrade gracefully when absent.
 */

export const app = createApp();

export { createApp };

const handler = serverless(app);

export default handler as (event: unknown, context: unknown) => Promise<unknown>;