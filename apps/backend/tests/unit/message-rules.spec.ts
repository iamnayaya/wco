import { createHmac } from 'node:crypto';

import {
  detectIntent,
  detectLanguage,
  extractEntities,
  extractMoneyAmounts,
  normalizeText,
  renderTemplate,
  scoreConfidence,
  withinSessionWindow,
} from '../../src/modules/messages/services/nlp.service.js';
import { CANNED_REPLIES, GENERIC_REPLY, isWithinWorkingHours } from '../../src/modules/messages/services/responder.service.js';

/**
 * Pure-rule specs for the messages/AI pipeline: NLP heuristics (intents,
 * entities, language), confidence scoring, session-window math, working-hours
 * gating, Meta webhook flattening/signature verification and ingress guards.
 *
 * Non-ASCII fixtures use unicode escapes so the suite survives any
 * encoding-hostile tooling.
 */

const NAIRA = '\u20A6';
const HOUR = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Text normalization + intents
// ---------------------------------------------------------------------------

describe('normalizeText', () => {
  it('lowercases and strips punctuation/emoji but keeps the naira sign', () => {
    expect(normalizeText(`Hello!! How Much is the Rice?? \u{1F64F}`)).toBe('hello how much is the rice');
    expect(normalizeText(`${NAIRA}1,500`)).toBe(`${NAIRA}1 500`);
  });
});

describe('detectIntent', () => {
  it('returns UNKNOWN with low confidence for gibberish', () => {
    const m = detectIntent('xkcd flurb quux');
    expect(m.intent).toBe('UNKNOWN');
    expect(m.confidence).toBe(0.3);
    expect(m.matchedKeywords).toEqual([]);
  });

  it('detects greetings across languages', () => {
    expect(detectIntent('Hello there').intent).toBe('GREETING');
    expect(detectIntent('Sannu, how are you').intent).toBe('GREETING');
    expect(detectIntent('Bonjour').intent).toBe('GREETING');
  });

  it('detects price inquiries in English and Pidgin', () => {
    expect(detectIntent('how much is the rice').intent).toBe('PRICE_INQUIRY');
    expect(detectIntent('abeg nawa o for this bag').intent).toBe('PRICE_INQUIRY');
  });

  it('detects availability questions', () => {
    const m = detectIntent('do you have this in stock');
    expect(m.intent).toBe('PRODUCT_AVAILABILITY');
    expect(m.confidence).toBeGreaterThan(0.8);
  });

  it('detects order intent over weaker overlapping lexicons', () => {
    expect(detectIntent('i want to buy 3 bags of rice').intent).toBe('ORDER_INTENT');
    expect(detectIntent('mo fe ra two shirts').intent).toBe('ORDER_INTENT');
  });

  it('flags complaints, refunds and human requests (hard escalation intents)', () => {
    expect(detectIntent('this is a scam, terrible service').intent).toBe('COMPLAINT');
    expect(detectIntent('I want my money back').intent).toBe('REFUND');
    expect(detectIntent('please let me speak to a human').intent).toBe('HUMAN_REQUEST');
  });

  it('prefers higher-priority custom intents over built-ins', () => {
    const customs = [
      { name: 'DELIVERY_LEKKI', keywords: ['lekki delivery'], priority: 5 },
      { name: 'WHOLESALE', keywords: ['bulk price'], priority: 10 },
    ];
    const m = detectIntent('do you do bulk price for rice?', customs);
    expect(m.intent).toBe('WHOLESALE');
    expect(m.confidence).toBe(0.9);
    // Lower-priority custom still beats built-ins.
    expect(detectIntent('lekki delivery today', customs).intent).toBe('DELIVERY_LEKKI');
    // Built-in fallback when no custom keyword hits.
    expect(detectIntent('what is the price', customs).intent).toBe('PRICE_INQUIRY');
  });
});

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

describe('extractMoneyAmounts', () => {
  it('parses naira symbols, NGN prefixes, k-suffixes and naira words from raw text', () => {
    expect(extractMoneyAmounts(`${NAIRA}1,500 for the shoes`)).toEqual([1500]);
    expect(extractMoneyAmounts('that one is NGN2000')).toEqual([2000]);
    expect(extractMoneyAmounts('i can pay 3.5k')).toEqual([3500]);
    expect(extractMoneyAmounts('2500 Naira last')).toEqual([2500]);
  });

  it('deduplicates repeated amounts and ignores bare numbers without units', () => {
    expect(extractMoneyAmounts(`${NAIRA}500 or 500 naira?`)).toEqual([500]);
    expect(extractMoneyAmounts('send me 5 packets')).toEqual([]);
  });
});

describe('extractEntities', () => {
  it('extracts quantities from digits and number words', () => {
    expect(extractEntities('i want two bags').quantities).toEqual([2]);
    expect(extractEntities('send 3 packs and 12 bottles').quantities).toEqual([3, 12]);
  });

  it('extracts clothing sizes, shoe sizes and colors', () => {
    const e = extractEntities('do you have XL in red? size 42 also');
    expect(e.sizes).toEqual(expect.arrayContaining(['XL', '42']));
    expect(e.colors).toContain('red');
  });

  it('builds product hints from significant tokens only', () => {
    const e = extractEntities('how much is the rice and beans');
    expect(e.productHints).toEqual(expect.arrayContaining(['rice', 'beans']));
    expect(e.productHints).not.toContain('the');
    expect(e.productHints).not.toContain('much');
  });

  it('combines money into entities', () => {
    expect(extractEntities(`${NAIRA}7500 abeg`).amounts).toEqual([7500]);
    expect(extractEntities('i can pay 3.5k for it').amounts).toEqual([3500]);
  });
});

describe('detectLanguage', () => {
  it.each([
    ['abeg wetin dey happen', 'pcm'],
    ['sannu na gode', 'ha'],
    ['bawo ni o', 'yo'],
    ['kedu imela', 'ig'],
    ['asante sana karibu', 'sw'],
    ['bonjour je veux commander', 'fr'],
    ['where is my order please', 'en'],
  ])('maps "%s" to %s', (text, lang) => {
    expect(detectLanguage(text)).toBe(lang);
  });
});

describe('scoreConfidence', () => {
  it('keeps full credit for template-supported languages', () => {
    expect(scoreConfidence(0.9, 'en', false)).toBeCloseTo(0.9);
    expect(scoreConfidence(0.9, 'pcm', false)).toBeCloseTo(0.9);
  });

  it('decays unsupported languages and rewards entity evidence', () => {
    expect(scoreConfidence(0.9, 'fr', false)).toBeCloseTo(0.81);
    expect(scoreConfidence(0.9, 'ha', true)).toBeCloseTo(0.84);
  });

  it('clamps to the 0.05..0.98 band', () => {
    expect(scoreConfidence(1, 'en', true)).toBe(0.98);
    expect(scoreConfidence(0.04, 'fr', false)).toBeGreaterThanOrEqual(0.05);
  });
});

// ---------------------------------------------------------------------------
// Session window + working hours + templates
// ---------------------------------------------------------------------------

describe('withinSessionWindow', () => {
  const last = new Date('2026-01-15T10:00:00Z');
  it('accepts fresh messages inside 24h', () => {
    expect(withinSessionWindow(last, new Date(last.getTime() + 23 * HOUR))).toBe(true);
  });
  it('closes exactly at 24h', () => {
    expect(withinSessionWindow(last, new Date(last.getTime() + 24 * HOUR))).toBe(false);
    expect(withinSessionWindow(last, new Date(last.getTime() + 25 * HOUR))).toBe(false);
  });
});

describe('isWithinWorkingHours', () => {
  const hours = { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] };

  it('accepts weekday times inside the window (inclusive end)', () => {
    expect(isWithinWorkingHours(hours, new Date('2026-01-14T10:00:00Z'))).toBe(true); // Wed
    expect(isWithinWorkingHours(hours, new Date('2026-01-14T09:00:00Z'))).toBe(true);
    expect(isWithinWorkingHours(hours, new Date('2026-01-14T18:00:00Z'))).toBe(true);
  });

  it('rejects early mornings and weekends', () => {
    expect(isWithinWorkingHours(hours, new Date('2026-01-14T07:30:00Z'))).toBe(false);
    expect(isWithinWorkingHours(hours, new Date('2026-01-17T12:00:00Z'))).toBe(false); // Sat
  });

  it('fails open on malformed config and honours empty day lists', () => {
    expect(isWithinWorkingHours({ start: 'oops' }, new Date('2026-01-17T03:00:00Z'))).toBe(true);
    expect(isWithinWorkingHours({ start: '09:00', end: '18:00' }, new Date('2026-01-17T12:00:00Z'))).toBe(true);
  });
});

describe('renderTemplate', () => {
  it('substitutes known keys and tolerates whitespace', () => {
    expect(renderTemplate('Hi {{ storeName }}!', { storeName: 'WCO' })).toBe('Hi WCO!');
  });
  it('leaves unknown keys literal', () => {
    expect(renderTemplate('hey {{nope}}', {})).toBe('hey {{nope}}');
  });
});

describe('canned reply catalog', () => {
  it('covers templated intents and keeps static bodies non-empty', () => {
    for (const intent of ['GREETING', 'PRICE_INQUIRY', 'PRODUCT_AVAILABILITY', 'PRODUCT_INFO']) {
      expect(CANNED_REPLIES[intent]).toContain('{{');
    }
    expect(CANNED_REPLIES['DELIVERY'].length).toBeGreaterThan(10);
    expect(GENERIC_REPLY).toContain('{{storeName}}');
  });
});

// ---------------------------------------------------------------------------
// Webhook payload flattening + guards
// ---------------------------------------------------------------------------

type WebhookModule = typeof import('../../src/modules/messages/services/webhook.service.js');

function loadWebhookModule(): WebhookModule {
  let mod!: WebhookModule;
  jest.isolateModules(() => {
    mod = require('../../src/modules/messages/services/webhook.service.js') as WebhookModule;
  });
  return mod;
}

describe('normalizeMetaPayload', () => {
  const mod = loadWebhookModule();

  it('flattens entries/changes into one row per message', () => {
    const rows = mod.normalizeMetaPayload({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: 'PNID1' },
                contacts: [{ wa_id: '2348012345678' }],
                messages: [
                  { id: 'wamid.A', from: '2348012345678', timestamp: '1769400000', type: 'text', text: { body: 'how much' } },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      waMessageId: 'wamid.A',
      fromPhone: '+2348012345678',
      storePhoneNumberId: 'PNID1',
      type: 'text',
      body: 'how much',
      mediaUrl: null,
    });
    expect((rows[0].timestamp as Date).toISOString()).toBe(new Date(1769400000 * 1000).toISOString());
  });

  it('maps media messages to mediaUrl and null body', () => {
    const rows = mod.normalizeMetaPayload({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: 'P' }, messages: [{ id: 'm2', from: '2348000000000', type: 'image', image: { link: 'https://cdn/x.jpg' } }] } }] }],
    });
    expect(rows[0]).toMatchObject({ type: 'image', body: null, mediaUrl: 'https://cdn/x.jpg' });
  });

  it('skips poison entries instead of throwing', () => {
    const rows = mod.normalizeMetaPayload({
      entry: [
        { changes: [{ value: { messages: [{ id: 'no-phone' }] } }] }, // missing metadata
        { changes: [{ value: { metadata: { phone_number_id: 'P' }, messages: [{ id: 'bad-type', from: '1', type: 'hologram' }] } }] },
        { changes: [{ value: { metadata: { phone_number_id: 'P' }, statuses: [{ id: 'sent' }] } }] },
      ],
    });
    expect(rows).toEqual([]);
  });
});

describe('metaHandshake', () => {
  const mod = loadWebhookModule();

  it('echoes the challenge when mode+token match', () => {
    expect(mod.metaHandshake({ mode: 'subscribe', verifyToken: 'wco-verify-dev', challenge: 'CHZ' })).toBe('CHZ');
  });

  it('rejects wrong tokens/modes', () => {
    expect(() => mod.metaHandshake({ mode: 'subscribe', verifyToken: 'wrong', challenge: 'CHZ' })).toThrow(
      'Webhook verification failed',
    );
    expect(() => mod.metaHandshake({ mode: 'deny', verifyToken: 'wco-verify-dev', challenge: 'CHZ' })).toThrow();
  });
});

describe('assertIngressAllowed', () => {
  it('allows unauthenticated calls outside production when no key configured', () => {
    const mod = loadWebhookModule();
    expect(() => mod.assertIngressAllowed({}, 'test')).not.toThrow();
  });

  it('requires the shared key in production when unset', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const mod = loadWebhookModule();
      expect(() => mod.assertIngressAllowed({}, 'production')).toThrow('WEBHOOK_INGRESS_KEY');
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
    }
  });
});

describe('requireNonEmptyBody', () => {
  const mod = loadWebhookModule();

  it('passes text and media, rejects empty shells', () => {
    expect(() => mod.requireNonEmptyBody({ body: 'hi', mediaUrl: null, type: 'text' })).not.toThrow();
    expect(() => mod.requireNonEmptyBody({ body: null, mediaUrl: 'https://x/y.png', type: 'image' })).not.toThrow();
    expect(() => mod.requireNonEmptyBody({ body: null, mediaUrl: null, type: 'location' })).toThrow(
      'Unsupported location message without body or media',
    );
  });
});

describe('verifyMetaSignature', () => {
  const SECRET = 'test-app-secret';

  const sign = (body: string): string =>
    `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;

  function withEnv(mutate: () => void, run: (mod: WebhookModule) => void): void {
    const prevSecret = process.env.META_APP_SECRET;
    const prevNodeEnv = process.env.NODE_ENV;
    mutate();
    try {
      run(loadWebhookModule());
    } finally {
      if (prevSecret === undefined) delete process.env.META_APP_SECRET;
      else process.env.META_APP_SECRET = prevSecret;
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
    }
  }

  it('accepts valid signatures and rejects tampered bodies/missing headers', () => {
    withEnv(
      () => {
        process.env.META_APP_SECRET = SECRET;
      },
      (mod) => {
        const body = JSON.stringify({ ok: true });
        expect(() => mod.verifyMetaSignature(body, sign(body))).not.toThrow();
        expect(() => mod.verifyMetaSignature(body, `${sign(body)}ff`)).toThrow('Invalid webhook signature');
        expect(() => mod.verifyMetaSignature(body, undefined)).toThrow('Missing X-Hub-Signature-256');
        expect(() => mod.verifyMetaSignature(body, 'plaintext')).toThrow();
      },
    );
  });

  it('fails closed in production when META_APP_SECRET is missing', () => {
    withEnv(
      () => {
        delete process.env.META_APP_SECRET;
        process.env.NODE_ENV = 'production';
      },
      (mod) => {
        expect(() => mod.verifyMetaSignature('{}', 'sha256=abc')).toThrow('META_APP_SECRET');
      },
    );
  });

  it('stays permissive outside production when unconfigured', () => {
    withEnv(
      () => {
        delete process.env.META_APP_SECRET;
        process.env.NODE_ENV = 'test';
      },
      (mod) => {
        expect(() => mod.verifyMetaSignature('anything', undefined)).not.toThrow();
      },
    );
  });
});
