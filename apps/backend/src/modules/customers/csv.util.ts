import { ValidationError } from '@wco/shared';

/**
 * Minimal, dependency-free RFC 4180 CSV reader/writer.
 *
 * Why not a library: import/export needs quoted fields, embedded commas,
 * CRLF and BOM tolerance - ~80 lines covers it without pulling a parser
 * into the bundle. Excel compatibility: we emit UTF-8 with a BOM so Excel
 * opens it correctly, and accept a leading BOM on import.
 */

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/** Handles one char inside the tokenizer; returns true when consumed. */
function consumeQuoted(text: string, state: TokenState): boolean {
  const ch = text[state.i];
  if (state.inQuotes) {
    if (ch === '"' && text[state.i + 1] === '"') {
      state.field += '"';
      state.i += 1;
    } else if (ch === '"') {
      state.inQuotes = false;
    } else {
      state.field += ch;
    }
    return true;
  }
  return false;
}

interface TokenState {
  i: number;
  field: string;
  record: string[];
  inQuotes: boolean;
}

/** State-machine tokenizer: quotes, embedded commas/CR/LF. */
function tokenizeRecords(input: string): string[][] {
  const records: string[][] = [];
  const state: TokenState = { i: 0, field: '', record: [], inQuotes: false };
  const text = input;

  const endField = (): void => {
    state.record.push(state.field);
    state.field = '';
  };
  const endRecord = (): void => {
    endField();
    records.push(state.record);
    state.record = [];
  };

  for (state.i = 0; state.i < text.length; state.i += 1) {
    if (consumeQuoted(text, state)) continue;
    const ch = text[state.i];
    if (ch === '"') {
      state.inQuotes = true;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[state.i + 1] === '\n') state.i += 1;
      endRecord();
    } else {
      state.field += ch;
    }
  }
  // Final record when the file does not end with a newline.
  if (state.field !== '' || state.record.length > 0) endRecord();
  return records;
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const cleaned = tokenizeRecords(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (cleaned.length === 0) throw new ValidationError('CSV file is empty');
  const headers = cleaned[0].map((h) => h.trim().toLowerCase());
  const rows = cleaned.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim();
    });
    return row;
  });
  return { headers, rows };
}

/** Formula-injection guard: neutralize cells that spreadsheet apps execute. */
function safeCell(value: string): string {
  if (/^[=+\-@\t]/.test(value)) return `'${value}`;
  return value;
}

export function toCsv(headers: readonly string[], rows: readonly Record<string, unknown>[]): string {
  const escape = (raw: unknown): string => {
    const value = raw === null || raw === undefined ? '' : String(raw);
    // Formula guard runs BEFORE quoting so guarded cells stay guarded.
    const guarded = safeCell(value);
    return /["\n\r,]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  // BOM keeps Excel UTF-8-happy; CRLF is the RFC-preferred line ending.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
