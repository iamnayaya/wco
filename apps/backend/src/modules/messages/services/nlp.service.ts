/**
 * Deterministic NLP heuristics for the auto-responder.
 *
 * Design contract:
 *  - PURE functions only: no I/O, no clocks, no prisma. Every behavior here is
 *    unit-tested, including multilingual lexicons (en/pcm/ha/yo/ig/sw/fr).
 *  - The LLM (llm.client.ts) sits ON TOP of this module: heuristics always
 *    produce a grounded draft; the LLM may polish it when keys are present.
 *    When the LLM fails or is unconfigured, customers still get answers.
 */

export type IntentName =
  | 'GREETING'
  | 'PRICE_INQUIRY'
  | 'PRODUCT_AVAILABILITY'
  | 'PRODUCT_INFO'
  | 'ORDER_INTENT'
  | 'PAYMENT'
  | 'DELIVERY'
  | 'COMPLAINT'
  | 'REFUND'
  | 'HUMAN_REQUEST'
  | 'SMALL_TALK'
  | 'UNKNOWN';

export type LangCode = 'en' | 'pcm' | 'ha' | 'yo' | 'ig' | 'sw' | 'fr';

export interface CustomIntentInput {
  readonly name: string;
  readonly keywords: readonly string[];
  readonly priority: number;
}

export interface IntentMatch {
  /** Built-in IntentName or the store-taught AiIntent name (e.g. DELIVERY_LEKKI). */
  readonly intent: string;
  readonly confidence: number;
  readonly matchedKeywords: readonly string[];
}

export interface Entities {
  readonly quantities: readonly number[];
  readonly colors: readonly string[];
  readonly sizes: readonly string[];
  readonly amounts: readonly number[];
  /** Significant tokens used for catalog grounding. */
  readonly productHints: readonly string[];
}

// ---------------------------------------------------------------------------
// Lexicons
// ---------------------------------------------------------------------------

/** weight 2 = strong phrase, weight 1 = weak token. */
const INTENT_LEXICON: Readonly<Record<Exclude<IntentName, 'UNKNOWN' | 'CUSTOM'>, readonly (readonly [string, number])[]>> = {
  GREETING: [
    ['hello', 2], ['good morning', 2], ['good afternoon', 2], ['good evening', 2], ['hi ', 1],
    ['hey', 1], ['sannu', 2], ['salamu', 2], ['bawo', 2], ['ekaro', 2], ['ifo', 1],
    ['kedu', 2], ['ndewo', 2], ['habari', 2], ['jambo', 2], ['hujambo', 2], ['bonjour', 2], ['salut', 1],
    ['how far', 1],
  ],
  PRICE_INQUIRY: [
    ['how much', 2], ['price', 2], ['na how much', 2], ['nawa', 2], ['nawa o', 2], ['farashi', 2],
    ['elo', 1], ['dowo', 2], ['ego', 1], ['ire', 1], ['bei gani', 2], ['ngapi', 2], ['pesa ngapi', 2],
    ['prix', 2], ['combien', 2], ['cost', 1], ['last price', 2], ['your price', 1],
  ],
  PRODUCT_AVAILABILITY: [
    ['do you have', 2], ['got any', 2], ['in stock', 2], ['available', 2], ['still there', 1],
    ['akwai', 2], ['se o ni', 2], ['o nọ', 2], ['iko', 1], ['ipo', 1], ['disponible', 2], ['en stock', 2],
    ['restock', 1],
  ],
  PRODUCT_INFO: [
    ['what size', 2], ['what color', 2], ['colour', 1], ['spec', 1], ['details', 1],
    ['describe', 1], ['pictures', 1], ['photo', 1], ['original', 1], ['quality', 1],
  ],
  ORDER_INTENT: [
    ['i want', 2], ['i will take', 2], ["i'll take", 2], ['place order', 2], ['make order', 2],
    ['i want to buy', 2], ['mo fe ra', 2], ['chorum izu', 2], ['nataka', 2], ['kununuua', 2],
    ['je veux commander', 2], ['commander', 1], ['buy', 1], ['order', 1], ['ina bukata', 2], ['na so', 1],
  ],
  PAYMENT: [
    ['pay', 1], ['payment', 2], ['transfer', 1], ['account number', 2], ['pos ', 1], ['card', 1],
    ['biya', 2], ['sanwo', 2], ['kwụọ', 2], ['lipa', 2], ['malipo', 2], ['payer', 2], ['paiement', 2],
    ['invoice', 1], ['receipt', 1],
  ],
  DELIVERY: [
    ['delivery', 2], ['deliver', 1], ['shipping', 2], ['ship to', 2], ['waybill', 2], ['courier', 2],
    ['tracking', 2], ['when will it arrive', 2], ['how long', 1], ['isarwa', 2], ['ifiransẹ', 2],
    ['kufikisha', 2], ['livraison', 2], ['livrer', 2], ['pick up', 1], ['pickup', 1],
  ],
  COMPLAINT: [
    ['complain', 2], ['complaint', 2], ['terrible', 2], ['awful', 2], ['scam', 2], ['worst', 2],
    ['useless', 2], ['broken', 2], ['damaged', 2], ['not working', 2], ['too late', 1], ['wahala', 2],
    ['yawa', 2], ['damuwa', 2], ['shida', 2], ['problème', 2], ['réclamation', 2], ['angry', 1],
    ['disappointed', 2],
  ],
  REFUND: [
    ['refund', 2], ['my money back', 2], ['money back', 2], ['reverse it', 1], ['return it', 1],
    ['mayar da kudi', 2], ['rejesha', 2], ['remboursement', 2], ['remboursé', 2],
  ],
  HUMAN_REQUEST: [
    ['speak to a human', 2], ['real person', 2], ['talk to human', 2], ['call me', 2], ['customer care', 2],
    ['manager', 1], ['representative', 2], ['agent please', 2], ['mutum', 1], ['eniyan', 1],
    ['binadamu', 2], ['parler à quelqu\'un', 2],
  ],
  SMALL_TALK: [['thank you', 2], ['thanks', 2], ['god bless', 2], ['asante', 2], ['merci', 2], ['nagode', 2], ['oshe', 2]],
};

const LANGUAGE_MARKERS: Readonly<Record<Exclude<LangCode, 'en'>, readonly string[]>> = {
  pcm: ['abeg', 'wetin', 'wahala', 'oga', 'shey', 'abi', 'no vex', 'how far', 'na ', 'dey ', 'una'],
  ha: ['sannu', 'nawa', 'akwai', 'na gode', 'ina', 'kana', 'ke nan', 'da fatan', 'farashi', 'biya'],
  yo: ['bawo', 'elo', 'se o', 'mo fe', 'e jo', 'o dabo', 'eko', 'dowo', 'fẹ́', 'jọ̀wọ́'],
  ig: ['kedu', 'ndewo', 'ego', 'chọm', 'biko', 'ọ dị', 'imela', 'dalụ'],
  sw: ['habari', 'asante', 'karibu', 'nataka', 'bei', 'ngapi', 'lipa', 'sawa', 'pole', 'tafadhali'],
  fr: ['bonjour', 'merci', 'combien', 'prix', 'je veux', 's\'il vous plaît', 'livraison', 'oui', 'non'],
};

const COLOR_WORDS = [
  'red', 'blue', 'black', 'white', 'green', 'yellow', 'gold', 'silver', 'pink', 'purple',
  'brown', 'orange', 'grey', 'gray',
] as const;

const SIZE_TOKENS = ['xxs', 'xs', 'xl', 'xxl', 'xxxl'] as const;
const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
};

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalizeText(raw: string): string {
  return raw.toLowerCase().replace(/[^\p{L}\p{N}\s'₦#]/gu, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

function scoreLexicon(normalized: string, entries: readonly (readonly [string, number])[]): { score: number; strong: number; weak: number; matched: string[] } {
  let strong = 0;
  let weak = 0;
  const matched: string[] = [];
  for (const [phrase, weight] of entries) {
    if (normalized.includes(phrase.trim())) {
      matched.push(phrase.trim());
      if (weight >= 2) strong += 1;
      else weak += 1;
    }
  }
  return { score: strong * 2 + weak, strong, weak, matched };
}

/**
 * Keyword-weighted intent detection with store-taught intents first.
 * Confidence saturates at two strong hits — longer messages are not
 * proportionally more certain.
 */
function isSpecificIntent(intent: IntentName): boolean {
  return intent !== 'GREETING' && intent !== 'SMALL_TALK' && intent !== 'UNKNOWN';
}

export function detectIntent(rawText: string, customIntents: readonly CustomIntentInput[] = []): IntentMatch {
  const normalized = ` ${normalizeText(rawText)} `;

  const customRanked = [...customIntents].sort((a, b) => b.priority - a.priority);
  for (const custom of customRanked) {
    const hit = custom.keywords.find((k) => k.length > 0 && normalized.includes(normalizeText(k)));
    if (hit !== undefined) {
      return { intent: custom.name, confidence: 0.9, matchedKeywords: [hit] };
    }
  }

  let best: { intent: IntentName; result: ReturnType<typeof scoreLexicon> } | null = null;
  for (const [intent, entries] of Object.entries(INTENT_LEXICON) as [keyof typeof INTENT_LEXICON, readonly (readonly [string, number])[]][]) {
    const result = scoreLexicon(normalized, entries);
    if (result.score > 0) {
      if (best === null || result.score > best.result.score) {
        best = { intent: intent as IntentName, result };
      } else if (result.score === best.result.score && isSpecificIntent(intent as IntentName) && !isSpecificIntent(best.intent)) {
        best = { intent: intent as IntentName, result };
      }
    }
  }
  if (best === null) return { intent: 'UNKNOWN', confidence: 0.3, matchedKeywords: [] };

  const confidence = Math.min(0.98, 0.5 + best.result.strong * 0.19 + best.result.weak * 0.09);
  return { intent: best.intent, confidence, matchedKeywords: best.result.matched };
}

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

function extractQuantities(normalized: string, tokens: readonly string[]): Set<number> {
  const quantities = new Set<number>();
  for (const token of tokens) {
    if (token in NUMBER_WORDS) quantities.add(NUMBER_WORDS[token]);
  }
  const bareNumbers = normalized.matchAll(/(?:^|\s)(\d{1,3})(?=\s|$)/g);
  for (const match of bareNumbers) {
    const value = Number(match[1]);
    if (!Number.isNaN(value) && value > 0) quantities.add(value);
  }
  return quantities;
}

function extractSizes(normalized: string, tokens: readonly string[]): Set<string> {
  const sizes = new Set<string>();
  for (const size of SIZE_TOKENS) {
    if (tokens.includes(size)) sizes.add(size.toUpperCase());
  }
  // Two-digit numbers in the 30..48 band are shoe sizes in this market.
  const shoeMatch = /\b(\d{2})\b/.exec(normalized);
  if (shoeMatch !== null && shoeMatch.length > 1) {
    const digits = String(shoeMatch[1]);
    const value = Number(digits);
    if (value >= 30 && value <= 48) sizes.add(digits);
  }
  for (const word of ['small', 'medium', 'large']) {
    if (normalized.includes(word)) sizes.add(word);
  }
  return sizes;
}

export function extractEntities(rawText: string): Entities {
  const normalized = normalizeText(rawText);
  const tokens = normalized.split(' ');

  const colors = COLOR_WORDS.filter((c) => normalized.includes(c));
  const amounts = [...extractMoneyAmounts(rawText.toLowerCase())];

  const hintStop = new Set<string>([
    ...Object.keys(NUMBER_WORDS), ...COLOR_WORDS, ...SIZE_TOKENS,
    'the', 'and', 'for', 'you', 'have', 'this', 'that', 'with', 'want', 'much', 'how', 'what',
    'does', 'your', 'are', 'can', 'get', 'give', 'please', 'need', 'like', 'some', 'them', 'they',
  ]);
  const productHints = tokens.filter(
    (t) => t.length >= 3 && !hintStop.has(t) && !/^\d+$/.test(t),
  );

  return {
    quantities: [...extractQuantities(normalized, tokens)].sort((a, b) => a - b),
    colors,
    sizes: [...extractSizes(normalized, tokens)],
    amounts,
    productHints: productHints.slice(0, 6),
  };
}

/** ₦1,500 / NGN 2000 / 3.5k / 2500 naira — fed RAW text (normalizeText eats dots/commas). */
export function extractMoneyAmounts(rawText: string): number[] {
  const found = new Set<number>();
  const text = rawText.toLowerCase();
  // eslint-disable-next-line security/detect-unsafe-regex -- linear: [\d,]+ then optional fixed decimal
  const currencyMatches = text.matchAll(/(?:₦|ngn)\s?([\d,]+(?:\.\d+)?)/g);
  for (const m of currencyMatches) {
    if (m.length < 2) continue;
    const value = Number(String(m[1]).replace(/,/g, ''));
    if (!Number.isNaN(value)) found.add(value);
  }
  // eslint-disable-next-line security/detect-unsafe-regex -- linear: single number + optional decimal suffix
  const suffixMatches = text.matchAll(/\b(\d+(?:\.\d+)?)\s?(k|naira)\b/g);
  for (const m of suffixMatches) {
    const base = Number(m[1]);
    if (Number.isNaN(base)) continue;
    found.add(m[2] === 'k' ? base * 1000 : base);
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

export function detectLanguage(rawText: string): LangCode {
  const normalized = normalizeText(rawText);
  let bestLang: LangCode = 'en';
  let bestHits = 0;
  for (const [lang, markers] of Object.entries(LANGUAGE_MARKERS) as [Exclude<LangCode, 'en'>, readonly string[]][]) {
    const hits = markers.reduce((acc, marker) => acc + (normalized.includes(marker) ? 1 : 0), 0);
    if (hits > bestHits) {
      bestHits = hits;
      bestLang = lang;
    }
  }
  return bestLang;
}

// ---------------------------------------------------------------------------
// Confidence + session window + templates
// ---------------------------------------------------------------------------

/** Languages with curated canned templates get full credit; others decay. */
const TEMPLATE_SUPPORTED: readonly LangCode[] = ['en', 'pcm'];

export function scoreConfidence(intentConfidence: number, language: LangCode, entitiesFound: boolean): number {
  const langMultiplier = TEMPLATE_SUPPORTED.includes(language) ? 1 : 0.9;
  const entityBonus = entitiesFound ? 0.03 : 0;
  return Math.max(0.05, Math.min(0.98, intentConfidence * langMultiplier + entityBonus));
}

/** WhatsApp free-form messaging window: 24 h from the customer's last message. */
export function withinSessionWindow(lastCustomerMessageAt: Date, now: Date): boolean {
  return now.getTime() - lastCustomerMessageAt.getTime() < 24 * 60 * 60 * 1000;
}

/** {{mustache}} substitution; unknown keys stay literal for easy debugging. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
}
