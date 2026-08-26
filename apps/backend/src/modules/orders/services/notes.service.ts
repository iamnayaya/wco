import type { OrderNote } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

import { requireOrder } from './shared.js';

/**
 * Merchant notes on orders - "customer called, deliver after 5pm". Pinned
 * notes sort first (then newest); only the author (or an OWNER) may edit or
 * delete an entry, so context written by one agent is never silently rewritten.
 */
export class OrderNoteService {
  async create(
    storeId: string,
    orderId: string,
    data: { body: string; pinned: boolean },
    authorId: string | null,
  ): Promise<OrderNote> {
    await requireOrder(storeId, orderId);
    return prisma.orderNote.create({
      data: { orderId, body: data.body, pinned: data.pinned, authorId },
    });
  }

  async list(storeId: string, orderId: string): Promise<OrderNote[]> {
    await requireOrder(storeId, orderId);
    const notes = await prisma.orderNote.findMany({ where: { orderId } });
    return sortNotes(notes);
  }

  async getOwned(storeId: string, orderId: string, noteId: string): Promise<OrderNote> {
    await requireOrder(storeId, orderId);
    const rows = await prisma.orderNote.findMany({ where: { id: noteId, orderId }, take: 1 });
    const note = rows.at(0);
    if (!note) throw new NotFoundError('Order note');
    return note;
  }

  async update(
    storeId: string,
    orderId: string,
    noteId: string,
    patch: { body?: string; pinned?: boolean },
    actor: { userId: string | null; role: string },
  ): Promise<OrderNote> {
    const note = await this.getOwned(storeId, orderId, noteId);
    assertMayEdit(note, actor);
    return prisma.orderNote.update({ where: { id: note.id }, data: patch });
  }

  async remove(
    storeId: string,
    orderId: string,
    noteId: string,
    actor: { userId: string | null; role: string },
  ): Promise<void> {
    const note = await this.getOwned(storeId, orderId, noteId);
    assertMayEdit(note, actor);
    await prisma.orderNote.delete({ where: { id: note.id } });
  }
}

function assertMayEdit(note: OrderNote, actor: { userId: string | null; role: string }): void {
  if (actor.role === 'OWNER' || actor.role === 'ADMIN') return;
  if (note.authorId === null || note.authorId !== actor.userId) {
    throw new ForbiddenError('Only the author (or a manager) may modify this note');
  }
}

/** Pinned first, then newest - mirrors the customer notes timeline UX. */
export function sortNotes(notes: OrderNote[]): OrderNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export const orderNoteService = new OrderNoteService();
