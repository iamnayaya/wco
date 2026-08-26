import { ValidationError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';
import { normalizePhone } from '../../../utils/phone.js';
import { parseCsv, toCsv } from '../csv.util.js';
import type { ListCustomersV2Query } from '../customers.dto.js';

import { customerDirectoryService } from './directory.service.js';

/**
 * Bulk import/export. CSV is the interchange format (informal traders live in
 * spreadsheets); rows are validated individually - one bad row never poisons
 * the batch. Duplicates (per-store phone) are skipped and reported.
 */

export interface ImportRowError {
  readonly row: number;
  readonly error: string;
}

export interface ImportResult {
  readonly created: number;
  readonly skippedDuplicates: number;
  readonly errors: ImportRowError[];
  readonly totalRows: number;
}

const IMPORT_MAX_BYTES = 10 * 1024 * 1024; // 10MB

const REQUIRED_COLUMNS = ['phone'] as const;

/** Email shape check shared by the import validator. */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Processes one CSV row; throws Error with a human message on bad data. */
async function importRow(storeId: string, row: Record<string, string>): Promise<'created' | 'duplicate'> {
  const rawPhone = 'phone' in row ? row.phone : '';
  if (!rawPhone) throw new Error('phone is required');
  const waPhone = normalizePhone(rawPhone);
  const emailRaw = 'email' in row ? row.email : '';
  if (emailRaw && !isValidEmail(emailRaw)) {
    throw new Error(`invalid email "${emailRaw}"`);
  }
  return importKnownValidRow(storeId, { waPhone, emailRaw, row });
}

async function importKnownValidRow(
  storeId: string,
  input: { waPhone: string; emailRaw: string; row: Record<string, string> },
): Promise<'created' | 'duplicate'> {
  const existing = await prisma.customer.findFirst({ where: { storeId, waPhone: input.waPhone } });
  if (existing) return 'duplicate';
  const tagsRaw = 'tags' in input.row ? input.row.tags : '';
  const tags = tagsRaw
    .split(/[;|]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
  await prisma.customer.create({
    data: {
      storeId,
      waPhone: input.waPhone,
      name: ('name' in input.row ? input.row.name : '') || null,
      email: input.emailRaw || null,
      tags,
      notes: ('notes' in input.row ? input.row.notes : '') || null,
      lastSeenAt: new Date(),
    },
  });
  return 'created';
}

/** Batch driver: per-row isolation - one bad row never poisons the batch. */
async function runImportRows(
  storeId: string,
  rows: Record<string, string>[],
): Promise<ImportResult> {
  let created = 0;
  let skippedDuplicates = 0;
  const errors: ImportRowError[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const lineNo = i + 2; // +1 header, +1 human numbering
    try {
      const outcome = await importRow(storeId, rows[i]);
      if (outcome === 'created') created += 1;
      else skippedDuplicates += 1;
    } catch (err) {
      errors.push({ row: lineNo, error: err instanceof Error ? err.message : 'invalid row' });
    }
  }
  return { created, skippedDuplicates, errors, totalRows: rows.length };
}

export class CustomerImportExportService {
  async importCsv(storeId: string, file: { buffer: Buffer; mimetype: string; originalname: string; size: number }): Promise<ImportResult> {
    if (file.size > IMPORT_MAX_BYTES) {
      throw new ValidationError('File exceeds the 10MB limit');
    }
    const name = file.originalname.toLowerCase();
    const mime = file.mimetype.toLowerCase();
    const looksCsv =
      name.endsWith('.csv') || mime === 'text/csv' || mime === 'application/vnd.ms-excel' || mime === 'text/plain';
    if (!looksCsv) {
      throw new ValidationError('Only CSV files are supported (.csv). Export your Excel sheet as CSV first.');
    }

    const parsed = parseCsv(file.buffer.toString('utf8'));
    const firstRow = parsed.rows.at(0) ?? {};
    for (const col of REQUIRED_COLUMNS) {
      if (!(col in firstRow)) {
        throw new ValidationError(`Missing required column "${col}"`, {
          found: parsed.headers.join(', '),
        });
      }
    }

    return runImportRows(storeId, parsed.rows);
  }

  /**
   * Exports the filtered customer set as RFC-4180 CSV (UTF-8 BOM so Excel
   * opens it cleanly). Filtering mirrors GET /customers via the same schema.
   */
  async exportCsv(storeId: string, query: ListCustomersV2Query): Promise<string> {
    const where = customerDirectoryService.buildWhere(storeId, query);
    const rows = await prisma.customer.findMany({
      where,
      orderBy: [{ [query.sortBy]: query.sortOrder }],
    });
    return toCsv(
      ['name', 'phone', 'email', 'tags', 'segment', 'totalSpent', 'ordersCount', 'lastOrderAt', 'marketingOptIn'],
      rows.map((c) => ({
        name: c.name ?? '',
        phone: c.waPhone,
        email: c.email ?? '',
        tags: c.tags.join(';'),
        segment: c.segment ?? '',
        totalSpent: String(c.totalSpent),
        ordersCount: c.ordersCount,
        lastOrderAt: c.lastOrderAt ? c.lastOrderAt.toISOString() : '',
        marketingOptIn: c.marketingOptIn ? 'yes' : 'no',
      })),
    );
  }
}

export const customerImportExportService = new CustomerImportExportService();
