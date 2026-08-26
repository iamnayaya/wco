import type { Response } from 'express';

import { sendSuccess } from '../../src/utils/api-response.js';
import { generateApiToken, hashToken, safeEqual, sha256, signPayload } from '../../src/utils/crypto.js';
import { buildNextCursor, decodeCursor, encodeCursor } from '../../src/utils/pagination.js';

/** Pure-utility unit tests: crypto helpers, cursor pagination, API envelope. */

describe('crypto utils', () => {
  it('sha256 produces the canonical digest', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('hashToken is stable for refresh-token rotation checks', () => {
    const raw = 'abc123';
    expect(hashToken(raw)).toBe(sha256(raw));
  });

  it('API tokens carry the wco_ prefix and a display prefix', () => {
    const { token, prefix } = generateApiToken();
    expect(token.startsWith('wco_')).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    expect(prefix).toBe(token.slice(0, 12));
    expect(generateApiToken().token).not.toBe(token);
  });

  it('HMAC signatures verify against the same secret only', () => {
    const sig = signPayload('body', 'secret');
    expect(sig).toBe(signPayload('body', 'secret'));
    expect(sig).not.toBe(signPayload('body', 'other-secret'));
    expect(safeEqual(sig, signPayload('body', 'secret'))).toBe(true);
    expect(safeEqual(sig, 'deadbeef')).toBe(false);
  });
});

describe('cursor pagination', () => {
  it('round-trips ids and dates opaquely', () => {
    const cursor = encodeCursor(new Date('2026-01-01T00:00:00Z'));
    expect(decodeCursor(cursor)).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns null next-cursor on the last page', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(buildNextCursor(items, 5)).toBeNull();
    expect(buildNextCursor(items, 2)).toBe(encodeCursor('b'));
  });
});

describe('sendSuccess envelope', () => {
  interface MockStore {
    status?: number;
    body?: unknown;
    headers: Record<string, string>;
  }
  const res = (): { r: Response; store: MockStore } => {
    const store: MockStore = { headers: {} };
    const r = Object.assign(store, {
      status(code: number) {
        store.status = code;
        return this;
      },
      json(body: unknown) {
        store.body = body;
        return this;
      },
      setHeader(k: string, v: string) {
        store.headers[k] = v;
      },
    }) as unknown as Response;
    return { r, store };
  };

  it('wraps data with success:true and honors status codes + meta', () => {
    const { r, store } = res();
    sendSuccess(r, { id: 1 }, { pagination: { nextCursor: null } }, 201);
    expect(store.status).toBe(201);
    expect(store.body).toEqual({
      success: true,
      data: { id: 1 },
      meta: { pagination: { nextCursor: null } },
    });
  });

  it('omits meta when absent', () => {
    const { r, store } = res();
    sendSuccess(r, 'ok');
    expect(store.body).toEqual({ success: true, data: 'ok' });
  });
});
