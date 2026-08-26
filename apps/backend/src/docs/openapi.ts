import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * OpenAPI documentation endpoints.
 *
 * The canonical spec lives at repo-root docs/api/openapi.yaml (Prompt 3
 * artifact, single source of truth). Resolution order:
 *   1. OPENAPI_SPEC_PATH env override (containers mount the spec explicitly)
 *   2. walk up from __dirname (covers both tsx/src and dist/ layouts)
 * If the file cannot be found we still serve a minimal self-describing spec
 * so /docs never 404s - broken docs links are worse than reduced docs.
 */

const SPEC_CANDIDATES = [
  process.env.OPENAPI_SPEC_PATH,
  path.resolve(__dirname, '../../../docs/api/openapi.yaml'),
  path.resolve(__dirname, '../../../../docs/api/openapi.yaml'),
  path.resolve(__dirname, '../../../../../docs/api/openapi.yaml'),
].filter((p): p is string => Boolean(p));

const FALLBACK_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'WCO Backend API',
    version: '1.0.0',
    description:
      'WhatsApp Commerce OS API. Full specification: docs/api/openapi.yaml in the repository ' +
      '(mount it via OPENAPI_SPEC_PATH in this environment).',
  },
  servers: [{ url: '/api/v1' }],
  paths: {},
};

function loadSpec(): string {
  for (const candidate of SPEC_CANDIDATES) {
    try {
      // Candidate paths derive from OPENAPI_SPEC_PATH env + repo-relative
      // fallbacks - never from request input.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (existsSync(candidate)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const yaml = readFileSync(candidate, 'utf8');
        logger.info('docs.openapi-loaded', { path: candidate });
        return yaml;
      }
    } catch {
      // try next candidate
    }
  }
  logger.warn('docs.openapi-not-found', { candidates: SPEC_CANDIDATES });
  return JSON.stringify(FALLBACK_SPEC, null, 2);
}

const specYaml = loadSpec();

export const docsRouter: Router = Router();

// Raw spec for codegen pipelines + SDK consumers (curl-able contract).
// Swagger-UI fetches this same URL, so explorer and codegen always agree.
docsRouter.get('/openapi.yaml', (_req, res) => {
  res.type('text/yaml').send(specYaml);
});

if (!isProd) {
  // Interactive explorer everywhere except prod (prod relies on the versioned
  // spec artifact published to the internal docs site).
  docsRouter.use('/docs', swaggerUi.serve);
  docsRouter.get(
    '/docs',
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: '/openapi.yaml', tryItOutEnabled: true },
      customSiteTitle: 'WCO API Explorer',
    }),
  );
}
