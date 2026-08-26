import { ValidationError } from '@wco/shared';
import { Router, type Request, type Response } from 'express';

import { authService } from '../../services/auth.service.js';
import {
  listProviders,
  resolveCallback,
  startAuthorization,
  type OAuthProvider,
} from '../../services/oauth.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

/**
 * Social login routes (Google / Facebook / Apple).
 *
 *   GET /api/v1/auth/:provider/start         -> consent URL (+ CSRF state)
 *   GET|POST /api/v1/auth/:provider/callback -> code exchange -> session
 *
 * The callback returns the session as JSON so SPAs and mobile shells can pick
 * it up; native apps use deep links. Apple posts back (response_mode=form_post)
 * which is why the callback also accepts POST.
 */

function providerOf(req: Request): OAuthProvider {
  const raw = req.params.provider;
  if (raw !== 'google' && raw !== 'facebook' && raw !== 'apple') {
    throw new ValidationError(`Unknown OAuth provider "${String(raw)}"`);
  }
  return raw;
}

async function start(req: Request, res: Response): Promise<void> {
  const provider = providerOf(req);
  const { url } = await startAuthorization(provider);
  if (req.query.redirect === '1') {
    res.redirect(url);
    return;
  }
  sendSuccess(res, { provider, authorizeUrl: url });
}

async function callback(req: Request, res: Response): Promise<void> {
  const provider = providerOf(req);
  const code = typeof req.query.code === 'string' ? req.query.code : String(req.body?.code ?? '');
  const state = typeof req.query.state === 'string' ? req.query.state : String(req.body?.state ?? '');
  if (!code || !state) throw new ValidationError('Missing code/state in OAuth callback');
  const { profile } = await resolveCallback(provider, code, state);
  const { tokens, user, created } = await authService.oauthSignIn(profile, {
    ip: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  });
  sendSuccess(res, { user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role }, ...tokens, created }, undefined, created ? 201 : 200);
}

export const oauthRouter: Router = Router();

oauthRouter.get('/providers', (_req, res) => {
  sendSuccess(res, { providers: listProviders() });
});

// Dynamic segments so unknown providers surface as 422 from providerOf()
// instead of falling through to a 404.
oauthRouter.get('/:provider/start', asyncHandler(start));
oauthRouter.get('/:provider/callback', asyncHandler(callback));
oauthRouter.post('/:provider/callback', asyncHandler(callback));
