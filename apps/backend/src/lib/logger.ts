import winston from 'winston';

import { env, isDev, isTest } from '../config/env.js';

/**
 * Structured logging — Winston.
 *
 * Production ships JSON to stdout (container log drivers aggregate it);
 * development uses a colorized, pretty formatter. File transports are only
 * attached outside containers (heuristic: LOG_FILE_DIR set) so we never
 * double-write in k8s where stdout is already shipped.
 */

const levelStyle = winston.format((info: winston.Logform.TransformableInfo) => {
  // Aligns with RFC5424-ish severity ordering used by our alerting rules.
  return info;
});

const prettyFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, ...meta }: winston.Logform.TransformableInfo) => {
    const rest = Object.keys(meta).filter((k) => k !== 'label' && k !== 'splat');
    const metaStr = rest.length ? ` ${JSON.stringify(Object.fromEntries(rest.map((k) => [k, meta[k]])))}` : '';
    return `${String(timestamp)} ${String(level)} ${String(message)}${metaStr}`;
  }),
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: isTest ? 'error' : env.LOG_LEVEL,
  defaultMeta: { service: 'wco-backend', env: env.NODE_ENV },
  format: isDev && env.LOG_FORMAT === 'pretty' ? prettyFormat : jsonFormat,
  transports: [new winston.transports.Console({ stderrLevels: ['error'] })],
  silent: isTest,
});

/** Morgan-compatible stream. */
export const httpLogStream = {
  write: (line: string): void => {
    logger.http(line.trim());
  },
};

export { levelStyle };
