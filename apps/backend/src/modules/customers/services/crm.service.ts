import type { Customer, CustomerNote, CustomerSegment, CustomerTag, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '@wco/shared';
import type { z } from 'zod';

import { prisma } from '../../../lib/prisma.js';
import type {
  createNoteSchema,
  createSegmentSchema,
  createTagSchema,
  segmentRuleSchema,
  updateNoteSchema,
  updateSegmentSchema,
  updateTagSchema,
} from '../customers.dto.js';

type TagCreate = z.infer<typeof createTagSchema>;
type TagUpdate = z.infer<typeof updateTagSchema>;
type NoteCreate = z.infer<typeof createNoteSchema>;
type NoteUpdate = z.infer<typeof updateNoteSchema>;
type SegmentCreate = z.infer<typeof createSegmentSchema>;
type SegmentUpdate = z.infer<typeof updateSegmentSchema>;
export type SegmentRule = z.infer<typeof segmentRuleSchema>;

/**
 * Ownership guard shared by every sub-resource service: a customer id is only
 * ever addressed through its storeId. This is THE tenant boundary for CRM data.
 */
async function ownCustomer(storeId: string, customerId: string): Promise<Customer> {
  const rows = await prisma.customer.findMany({ where: { id: customerId, storeId }, take: 1 });
  const customer = rows.at(0);
  if (!customer) throw new NotFoundError('Customer not found');
  return customer;
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export class CustomerTagService {
  async createTag(storeId: string, data: TagCreate): Promise<CustomerTag> {
    const clash = await prisma.customerTag.findFirst({ where: { storeId, name: data.name } });
    if (clash) throw new ConflictError('Tag already exists');
    return prisma.customerTag.create({ data: { storeId, name: data.name, color: data.color } });
  }

  async listTags(storeId: string): Promise<CustomerTag[]> {
    return prisma.customerTag.findMany({ where: { storeId }, orderBy: [{ name: 'asc' }] });
  }

  async getTagById(storeId: string, tagId: string): Promise<CustomerTag> {
    const rows = await prisma.customerTag.findMany({ where: { id: tagId, storeId }, take: 1 });
    const tag = rows.at(0);
    if (!tag) throw new NotFoundError('Tag not found');
    return tag;
  }

  async updateTag(storeId: string, tagId: string, data: TagUpdate): Promise<CustomerTag> {
    await this.getTagById(storeId, tagId);
    return prisma.customerTag.update({ where: { id: tagId }, data });
  }

  /** Deleting a tag also strips it from customers' denormalized arrays. */
  async deleteTag(storeId: string, tagId: string): Promise<void> {
    const tag = await this.getTagById(storeId, tagId);
    const tagged = await prisma.customer.findMany({ where: { storeId, tags: { has: tag.name } } });
    for (const customer of tagged) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { tags: customer.tags.filter((t) => t !== tag.name) },
      });
    }
    await prisma.customerTag.delete({ where: { id: tagId } });
  }

  /** Assigns the tag row AND syncs the denormalized customers.tags array. */
  async assignToCustomer(storeId: string, tagId: string, customerId: string): Promise<Customer> {
    const tag = await this.getTagById(storeId, tagId);
    const customer = await ownCustomer(storeId, customerId);
    if (!customer.tags.includes(tag.name)) {
      return prisma.customer.update({
        where: { id: customerId },
        data: { tags: [...customer.tags, tag.name] },
      });
    }
    return customer;
  }

  async removeFromCustomer(storeId: string, tagId: string, customerId: string): Promise<Customer> {
    const tag = await this.getTagById(storeId, tagId);
    const customer = await ownCustomer(storeId, customerId);
    return prisma.customer.update({
      where: { id: customerId },
      data: { tags: customer.tags.filter((t) => t !== tag.name) },
    });
  }
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export interface ListNotesQuery {
  readonly page: number;
  readonly pageSize: number;
}

export class CustomerNoteService {
  async createNote(storeId: string, customerId: string, authorId: string | null, data: NoteCreate): Promise<CustomerNote> {
    await ownCustomer(storeId, customerId);
    return prisma.customerNote.create({
      data: { customerId, authorId, body: data.body, pinned: data.pinned },
    });
  }

  async listNotes(
    storeId: string,
    customerId: string,
    query: ListNotesQuery,
  ): Promise<{ items: CustomerNote[]; total: number }> {
    await ownCustomer(storeId, customerId);
    const where: Prisma.CustomerNoteWhereInput = { customerId };
    const [items, total] = await Promise.all([
      prisma.customerNote.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.customerNote.count({ where }),
    ]);
    return { items, total };
  }

  async getNoteById(storeId: string, customerId: string, noteId: string): Promise<CustomerNote> {
    await ownCustomer(storeId, customerId);
    const rows = await prisma.customerNote.findMany({ where: { id: noteId, customerId }, take: 1 });
    const note = rows.at(0);
    if (!note) throw new NotFoundError('Note not found');
    return note;
  }

  async updateNote(storeId: string, customerId: string, noteId: string, data: NoteUpdate): Promise<CustomerNote> {
    await this.getNoteById(storeId, customerId, noteId);
    return prisma.customerNote.update({ where: { id: noteId }, data });
  }

  async deleteNote(storeId: string, customerId: string, noteId: string): Promise<void> {
    await this.getNoteById(storeId, customerId, noteId);
    await prisma.customerNote.delete({ where: { id: noteId } });
  }
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export class CustomerSegmentService {
  async createSegment(storeId: string, data: SegmentCreate): Promise<CustomerSegment> {
    const clash = await prisma.customerSegment.findFirst({ where: { storeId, name: data.name } });
    if (clash) throw new ConflictError('Segment already exists');
    return prisma.customerSegment.create({
      data: { storeId, name: data.name, description: data.description, rule: data.rule },
    });
  }

  async listSegments(storeId: string): Promise<CustomerSegment[]> {
    return prisma.customerSegment.findMany({ where: { storeId }, orderBy: [{ createdAt: 'desc' }] });
  }

  async getSegmentById(storeId: string, segmentId: string): Promise<CustomerSegment> {
    const rows = await prisma.customerSegment.findMany({ where: { id: segmentId, storeId }, take: 1 });
    const segment = rows.at(0);
    if (!segment) throw new NotFoundError('Segment not found');
    return segment;
  }

  async updateSegment(storeId: string, segmentId: string, data: SegmentUpdate): Promise<CustomerSegment> {
    const existing = await this.getSegmentById(storeId, segmentId);
    if (existing.isSystem && data.rule !== undefined) {
      throw new ConflictError('System segment rules are managed by the AI engine');
    }
    return prisma.customerSegment.update({ where: { id: segmentId }, data });
  }

  async deleteSegment(storeId: string, segmentId: string): Promise<void> {
    await this.getSegmentById(storeId, segmentId);
    await prisma.customerSegment.delete({ where: { id: segmentId } });
  }

  async addCustomer(storeId: string, segmentId: string, customerId: string): Promise<{ added: true }> {
    await this.getSegmentById(storeId, segmentId);
    await ownCustomer(storeId, customerId);
    const existing = await prisma.customerSegmentMember.findMany({ where: { segmentId, customerId } });
    if (!existing.at(0)) {
      await prisma.customerSegmentMember.create({ data: { segmentId, customerId } });
    }
    return { added: true };
  }

  async removeCustomer(storeId: string, segmentId: string, customerId: string): Promise<void> {
    await this.getSegmentById(storeId, segmentId);
    await ownCustomer(storeId, customerId);
    await prisma.customerSegmentMember.deleteMany({ where: { segmentId, customerId } });
  }
}

// ---------------------------------------------------------------------------
// AI segmentation engine
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Structural subset of Customer used by the matcher (Decimal-friendly). */
export interface MatchableCustomer {
  totalSpent: Prisma.Decimal | number;
  ordersCount: number;
  lastOrderAt: Date | null;
  createdAt: Date;
  marketingOptIn: boolean;
}

function spentWithin(c: MatchableCustomer, rule: SegmentRule): boolean {
  const spent = Number(c.totalSpent);
  if (rule.minTotalSpent !== undefined && spent < rule.minTotalSpent) return false;
  if (rule.maxTotalSpent !== undefined && spent > rule.maxTotalSpent) return false;
  return true;
}

function ordersWithin(c: MatchableCustomer, rule: SegmentRule): boolean {
  if (rule.minOrders !== undefined && c.ordersCount < rule.minOrders) return false;
  if (rule.maxOrders !== undefined && c.ordersCount > rule.maxOrders) return false;
  return true;
}

function idleWithin(c: MatchableCustomer, rule: SegmentRule, now: Date): boolean {
  const needsIdle = rule.idleDaysMin !== undefined || rule.idleDaysMax !== undefined;
  if (!needsIdle) return true;
  // Mock rows may carry `undefined` where Prisma yields null - treat as never.
  if (!c.lastOrderAt) return false;
  const idleDays = Math.floor((now.getTime() - c.lastOrderAt.getTime()) / DAY_MS);
  if (rule.idleDaysMin !== undefined && idleDays < rule.idleDaysMin) return false;
  if (rule.idleDaysMax !== undefined && idleDays > rule.idleDaysMax) return false;
  return true;
}

function isNewCustomer(c: MatchableCustomer, rule: SegmentRule, now: Date): boolean {
  if (rule.newWithinDays === undefined) return true;
  const ageDays = Math.floor((now.getTime() - c.createdAt.getTime()) / DAY_MS);
  return ageDays <= rule.newWithinDays && c.ordersCount <= 1;
}

/**
 * Pure rule matcher - unit tested. `rule` keys compose with AND semantics;
 * empty rule never matches automatically (manual-only segment).
 */
export function matchesRule(customer: MatchableCustomer, rule: SegmentRule, now = new Date()): boolean {
  if (Object.keys(rule).length === 0) return false;
  if (!spentWithin(customer, rule)) return false;
  if (!ordersWithin(customer, rule)) return false;
  if (!idleWithin(customer, rule, now)) return false;
  if (!isNewCustomer(customer, rule, now)) return false;
  if (rule.marketingOptIn !== undefined && customer.marketingOptIn !== rule.marketingOptIn) return false;
  return true;
}

interface SystemSegmentSpec {
  readonly name: string;
  readonly description: string;
  readonly rule: SegmentRule;
}

/** The default AI playbook. Thresholds tuned for NGN informal-trade ticket sizes. */
export const SYSTEM_SEGMENTS: readonly SystemSegmentSpec[] = [
  { name: 'VIP', description: 'Top spenders (>= 50,000 lifetime)', rule: { minTotalSpent: 50_000 } },
  { name: 'FREQUENT', description: '5+ orders', rule: { minOrders: 5, maxTotalSpent: 49_999 } },
  { name: 'NEW', description: 'Joined within 30 days, <= 1 order', rule: { newWithinDays: 30 } },
  { name: 'ONE_TIME', description: 'Single order, older than 30 days', rule: { minOrders: 1, maxOrders: 1, idleDaysMin: 31 } },
  { name: 'AT_RISK', description: '2+ orders, silent 30-90 days', rule: { minOrders: 2, idleDaysMin: 30, idleDaysMax: 90 } },
  { name: 'DORMANT', description: 'No orders in 90+ days', rule: { idleDaysMin: 91 } },
];

export interface AutoSegmentResult {
  readonly computedAt: Date;
  readonly perSegment: { segmentId: string; name: string; members: number; added: number; removed: number }[];
}

export class AutoSegmentService {
  /**
   * Recomputes system-segment memberships for a store by diffing desired vs
   * actual membership sets. O(customers × segments) with batched writes -
   * fine at CRM scale (10k customers/store), runs from cron or POST /auto.
   */
  async runForStore(storeId: string): Promise<AutoSegmentResult> {
    const now = new Date();

    // Idempotently ensure the six system segments exist.
    const segments = new Map<string, { id: string; rule: SegmentRule }>();
    for (const spec of SYSTEM_SEGMENTS) {
      const existing = await prisma.customerSegment.findFirst({ where: { storeId, name: spec.name } });
      const row =
        existing ??
        (await prisma.customerSegment.create({
          data: { storeId, name: spec.name, description: spec.description, rule: spec.rule, isSystem: true },
        }));
      segments.set(spec.name, { id: row.id, rule: spec.rule });
    }

    const customers = await prisma.customer.findMany({ where: { storeId } });
    const perSegment: AutoSegmentResult['perSegment'] = [];

    for (const [name, seg] of segments) {
      const desired = new Set(
        customers.filter((c) => matchesRule(c as unknown as MatchableCustomer, seg.rule, now)).map((c) => c.id),
      );
      const currentRows = await prisma.customerSegmentMember.findMany({ where: { segmentId: seg.id } });
      const current = new Set(currentRows.map((m) => m.customerId));

      let added = 0;
      let removed = 0;
      for (const customerId of desired) {
        if (!current.has(customerId)) {
          await prisma.customerSegmentMember.create({ data: { segmentId: seg.id, customerId, addedBy: 'ai' } });
          added += 1;
        }
      }
      for (const membership of currentRows) {
        if (!desired.has(membership.customerId)) {
          await prisma.customerSegmentMember.delete({ where: { id: membership.id } });
          removed += 1;
        }
      }
      await prisma.customerSegment.update({ where: { id: seg.id }, data: { lastComputedAt: now } });
      perSegment.push({ segmentId: seg.id, name, members: desired.size, added, removed });
    }

    // Keep the legacy `customers.segment` column in sync for cheap filters.
    const nameById = new Map([...segments.entries()].map(([name, s]) => [s.id, name]));
    for (const customer of customers) {
      const memberships = await prisma.customerSegmentMember.findMany({
        where: { customerId: customer.id },
      });
      const primary = memberships.map((m) => nameById.get(m.segmentId)).find((n): n is string => Boolean(n));
      if (primary && primary !== customer.segment) {
        await prisma.customer.update({ where: { id: customer.id }, data: { segment: primary } });
      }
    }

    return { computedAt: now, perSegment };
  }
}

export const customerTagService = new CustomerTagService();
export const customerNoteService = new CustomerNoteService();
export const customerSegmentService = new CustomerSegmentService();
export const autoSegmentService = new AutoSegmentService();
