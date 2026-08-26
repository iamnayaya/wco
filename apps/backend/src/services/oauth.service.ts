import { createSign, randomBytes } from 'node:crypto';

import { AppError, ValidationError } from '@wco/shared';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { getRedis } from '../lib/redis.js';

/**
 * OAuth 2.0 authorization-code login for Google, Facebook and Apple -
 * implemented directly on fetch (no passport), with a Redis-backed CSRF
 * `state` (one-time, 10-minute TTL) and Apple's ES256 client-secret JWT
 * minted per token request.
 *
 * Flow:
 *   GET /auth/:provider/start    -> 302 to provider consent screen
 *   GET /auth/:provider/callback -> code exchanged server-side, profile
 *                                   resolved, local account linked/created,
 *                                   session issued via redirect fragment.
 */

export type OAuthProvider = 'google' | 'facebook' | 'apple';

export interface OAuthProfile {
  readonly provider: OAuthProvider;
  readonly providerAccountId: string;
  readonly email: string;
  readonly fullName: string;
}

interface ProviderConfig {
  readonly clientId?: string;
  readonly clientSecret?: string;
  authorizeUrl: (redirectUri: string, state: string) => string;
  exchange: (code: string, redirectUri: string) => Promise<OAuthProfile>;
}

const OAUTH_STATE_TTL_SECONDS = 600;

// --- Apple client secret (ES256 JWT, regenerated per request) -----------------

function appleClientSecret(): string {
  const { APPLE_CLIENT_ID: clientId, APPLE_TEAM_ID: teamId, APPLE_KEY_ID: keyId, APPLE_PRIVATE_KEY: privateKey } = env;
  if (!clientId || !teamId || !keyId || !privateKey) throw new Error('Apple OAuth not configured');
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp: now + 600,
      aud: 'https://appleid.apple.com',
      sub: clientId,
    }),
  ).toString('base64url');
  const signer = createSign('sha256');
  signer.update(`${header}.${payload}`);
  const der = signer.sign({ key: privateKey.replace(/\\n/gu, '\n'), dsaEncoding: 'der' });
  return `${header}.${payload}.${der.toString('base64url')}`;
}

function assertConfigured(provider: OAuthProfile['provider'], cfg: ProviderConfig): void {
  if (!cfg.clientId || !cfg.clientSecret && provider !== 'apple') {
    throw new AppError('PROVIDER_UNAVAILABLE', `OAuth provider "${provider}" is not configured`);
  }
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    logger.error('oauth.http-error', { url, status: res.status });
    throw new AppError('PROVIDER_UNAVAILABLE', 'Upstream identity provider request failed');
  }
  return (await res.json()) as Record<string, unknown>;
}

// --- Provider registry ---------------------------------------------------------

function googleConfig(): ProviderConfig {
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: (redirect, state) => {
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID ?? '',
        redirect_uri: redirect,
        response_type: 'code',
        scope: 'openid email profile',
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    },
    exchange: async (code, redirect) => {
      const token = await fetchJson('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID ?? '',
          client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
          redirect_uri: redirect,
          grant_type: 'authorization_code',
        }),
      });
      const accessToken = String(token.access_token ?? '');
      if (!accessToken) throw new AppError('PROVIDER_UNAVAILABLE', 'Google token exchange failed');
      const userinfo = await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (typeof userinfo.sub !== 'string' || typeof userinfo.email !== 'string') {
        throw new ValidationError('Google account has no verifiable email');
      }
      return {
        provider: 'google',
        providerAccountId: userinfo.sub,
        email: userinfo.email.toLowerCase(),
        fullName: typeof userinfo.name === 'string' ? userinfo.name : userinfo.email.split('@')[0] ?? userinfo.email,
      };
    },
  };
}

function facebookConfig(): ProviderConfig {
  return {
    clientId: env.FACEBOOK_CLIENT_ID,
    clientSecret: env.FACEBOOK_CLIENT_SECRET,
    authorizeUrl: (redirect, state) => {
      const params = new URLSearchParams({
        client_id: env.FACEBOOK_CLIENT_ID ?? '',
        redirect_uri: redirect,
        response_type: 'code',
        scope: 'email public_profile',
        state,
      });
      return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
    },
    exchange: async (code, redirect) => {
      const tokenParams = new URLSearchParams({
        code,
        client_id: env.FACEBOOK_CLIENT_ID ?? '',
        client_secret: env.FACEBOOK_CLIENT_SECRET ?? '',
        redirect_uri: redirect,
      });
      const token = await fetchJson(
        `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`,
      );
      const accessToken = String(token.access_token ?? '');
      if (!accessToken) throw new AppError('PROVIDER_UNAVAILABLE', 'Facebook token exchange failed');
      const meParams = new URLSearchParams({ fields: 'id,name,email', access_token: accessToken });
      const me = await fetchJson(`https://graph.facebook.com/me?${meParams.toString()}`);
      if (typeof me.id !== 'string' || typeof me.email !== 'string') {
        throw new ValidationError('Facebook account has no verifiable email');
      }
      return {
        provider: 'facebook',
        providerAccountId: me.id,
        email: me.email.toLowerCase(),
        fullName: typeof me.name === 'string' ? me.name : me.email.split('@')[0] ?? me.email,
      };
    },
  };
}

function appleConfig(): ProviderConfig {
  return {
    get clientId(): string | undefined {
      return env.APPLE_CLIENT_ID;
    },
    get clientSecret(): string {
      return appleClientSecret();
    },
    authorizeUrl: (redirect, state) => {
      const params = new URLSearchParams({
        client_id: env.APPLE_CLIENT_ID ?? '',
        redirect_uri: redirect,
        response_type: 'code',
        scope: 'name email',
        response_mode: 'form_post',
        state,
      });
      return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    },
    exchange: async (code) => {
      const token = await fetchJson('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.APPLE_CLIENT_ID ?? '',
          client_secret: appleClientSecret(),
          grant_type: 'authorization_code',
          redirect_uri: redirectUri('apple'),
        }),
      });
      const idToken = String(token.id_token ?? '');
      if (!idToken) throw new AppError('PROVIDER_UNAVAILABLE', 'Apple token exchange failed');
      // Claims-only validation (aud/iss/exp); signature trust is inherited
      // from the TLS-protected token endpoint response rather than JWKS.
      const payloadPart = idToken.split('.')[1];
      if (!payloadPart) throw new AppError('PROVIDER_UNAVAILABLE', 'Malformed Apple id_token');
      const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as Record<string, unknown>;
      if (claims.iss !== 'https://appleid.apple.com' || claims.aud !== env.APPLE_CLIENT_ID) {
        throw new ValidationError('Apple id_token audience mismatch');
      }
      if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
        throw new ValidationError('Apple id_token expired');
      }
      const email = typeof claims.email === 'string'
        ? claims.email
        : `${String(claims.sub ?? 'user')}@privaterelay.appleid.com`;
      return {
        provider: 'apple',
        providerAccountId: String(claims.sub),
        email: email.toLowerCase(),
        fullName: 'Apple User',
      };
    },
  };
}

function providerConfigs(): Record<OAuthProvider, ProviderConfig> {
  return {
    google: googleConfig(),
    facebook: facebookConfig(),
    apple: appleConfig(),
  };
}

export function redirectUri(provider: OAuthProvider): string {
  const base = env.OAUTH_REDIRECT_BASE_URL ?? `http://localhost:${env.PORT}`;
  return `${base}/api/v1/auth/${provider}/callback`;
}

export function listProviders(): Record<string, boolean> {
  const cfgs = providerConfigs();
  return {
    google: Boolean(cfgs.google.clientId && cfgs.google.clientSecret),
    facebook: Boolean(cfgs.facebook.clientId && cfgs.facebook.clientSecret),
    apple: Boolean(env.APPLE_CLIENT_ID && env.APPLE_PRIVATE_KEY),
  };
}

/** One-time CSRF state; value encodes the provider only (nothing sensitive). */
export async function createState(provider: OAuthProvider): Promise<string> {
  const state = randomBytes(24).toString('base64url');
  await getRedis().set(`wco:oauth:state:${state}`, provider, 'EX', OAUTH_STATE_TTL_SECONDS);
  return state;
}

async function consumeState(state: string): Promise<OAuthProvider> {
  const raw = await getRedis().getdel(`wco:oauth:state:${state}`);
  if (!raw || !['google', 'facebook', 'apple'].includes(raw)) {
    throw new ValidationError('Invalid or expired OAuth state');
  }
  return raw as OAuthProvider;
}

/** Consent-screen URL + one-time CSRF state for kicking off the flow. */
export async function startAuthorization(provider: OAuthProvider): Promise<{ url: string; state: string }> {
  const cfg = providerConfigs()[provider];
  assertConfigured(provider, cfg);
  const state = await createState(provider);
  return { url: cfg.authorizeUrl(redirectUri(provider), state), state };
}

export interface ResolvedCallback {
  readonly provider: OAuthProvider;
  readonly profile: OAuthProfile;
}

export async function resolveCallback(provider: OAuthProvider, code: string, state: string): Promise<ResolvedCallback> {
  const stateProvider = await consumeState(state);
  if (stateProvider !== provider) throw new ValidationError('OAuth state/provider mismatch');
  const cfg = providerConfigs()[provider];
  assertConfigured(provider, cfg);
  const profile = await cfg.exchange(code, redirectUri(provider));
  return { provider, profile };
}
