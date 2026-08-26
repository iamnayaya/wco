import type { Request, Response } from 'express';

import { getAuth, getStoreId } from '../../middleware/rbac.js';
import { auditService } from '../../services/audit.service.js';
import { orderNotificationService } from '../../services/notification.service.js';
import { ordersService } from '../../services/orders.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import type { ListOrdersV2Query, OrderTransitionDto, UpdateOrderDto } from './orders.dto.js';
import {
  orderAiService,
  orderCancellationService,
  orderImportExportService,
  orderItemService,
  orderNoteService,
  orderRefundService,
  orderStatusHistoryService,
  requireOrderWithItems,
  whatsAppOrderSyncService,
} from './services/barrel.js';

/**
 * Orders controller.
 *
 * Creation is idempotent via the Idempotency-Key middleware (wired in
 * routes); state transitions are validated against the shared ORDER_TRANSITIONS
 * machine inside OrdersService. Audit entries and buyer notifications are
 * recorded fire-and-forget - a failed side effect must never roll back a
 * successful order mutation.
 */
export const ordersController = {
  async create(req: Request, res: Response): Promise<void> {
    const order = await ordersService.create(getStoreId(req), req.body);
    void auditService.record({
      action: 'order.create',
      resource: 'Order',
      resourceId: order.id,
      after: { total: Number(order.total) },
    });
    sendSuccess(res, order, undefined, 201);
  },

  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await ordersService.get(getStoreId(req), req.params.id));
  },

  async listLegacy(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    // Date-shaped `q` doubles as a created-after filter for "today's orders" UX.
    const query = { ...req.query };
    const createdAfter =
      typeof query.q === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.q) ? new Date(query.q) : undefined;
    sendSuccess(
      res,
      await ordersService.list(storeId, {
        ...query,
        createdAfter,
        limit: Number(query.limit) > 0 ? Number(query.limit) : 20,
      }),
      { pagination: { nextCursor: null } },
    );
  },

  async update(req: Request, res: Response): Promise<void> {
    const order = await ordersService.update(getStoreId(req), req.params.id, req.body as UpdateOrderDto);
    void auditService.record({ action: 'order.update', resource: 'Order', resourceId: order.id });
    sendSuccess(res, order);
  },

  async transition(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const body = req.body as OrderTransitionDto;
    const auth = getAuth(req);
    const actorId = auth.mode === 'user' ? auth.userId : null;
    // cancel() wraps transition(CANCELLED) + stock restoration.
    const order =
      body.status === 'CANCELLED'
        ? await ordersService.cancel(storeId, req.params.id, body.reason)
        : await ordersService.transition(storeId, req.params.id, body.status, body.reason, actorId);
    void auditService.record({
      action: `order.${body.status.toLowerCase()}`,
      resource: 'Order',
      resourceId: order.id,
      after: { status: body.status },
    });
    const contact = await ordersService.getCustomerContact(storeId, req.params.id);
    if (contact) {
      void orderNotificationService.dispatch(
        {
          orderNumber: order.orderNumber,
          status: order.status,
          total: String(order.total),
          currency: order.currency,
          customerName: contact.name,
          customerPhone: contact.waPhone,
        },
        body.status.toLowerCase() as Parameters<typeof orderNotificationService.dispatch>[1],
      );
    }
    sendSuccess(res, order);
  },

  // ---------------------------------------------------------------------------
  // v2 collection endpoints
  // ---------------------------------------------------------------------------

  async listV2(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as ListOrdersV2Query;
    const { items, total } = await ordersService.listV2(getStoreId(req), query);
    sendSuccess(res, items, { pagination: paginationMeta(query.page, query.pageSize, total) });
  },

  async search(req: Request, res: Response): Promise<void> {
    await ordersController.listV2(req, res);
  },

  async stats(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await ordersService.stats(getStoreId(req)));
  },

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await orderImportExportService.exportCsv(
      getStoreId(req),
      req.query as unknown as Partial<ListOrdersV2Query>,
    );
    const stamp = new Date().toISOString().slice(0, 10);
    res.status(200).setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${stamp}.csv"`);
    res.send(csv);
  },

  async importCsv(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
      reply422(res, 'No file uploaded');
      return Promise.resolve();
    }
    const report = await orderImportExportService.importCsv(getStoreId(req), file);
    void auditService.record({
      action: 'order.import',
      resource: 'Order',
      resourceId: getStoreId(req),
      after: { ...report },
    });
    sendSuccess(res, report, undefined, 201);
  },

  async syncWhatsApp(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const summary = await whatsAppOrderSyncService.syncStore(storeId);
    void auditService.record({
      action: 'order.wa-sync',
      resource: 'Store',
      resourceId: storeId,
      after: { ...summary },
    });
    sendSuccess(res, summary);
  },
} as const;

// ---------------------------------------------------------------------------
// Sub-resource controllers. Every handler re-asserts store ownership through
// its service layer, so a guessed foreign id answers 404, never a leak.
// ---------------------------------------------------------------------------

export const itemsController = {
  list: (req: Request, res: Response): Promise<void> =>
    reply(res, orderItemService.list(getStoreId(req), req.params.id)),
  get: (req: Request, res: Response): Promise<void> =>
    reply(res, orderItemService.getOwned(getStoreId(req), req.params.id, req.params.itemId)),
  update: (req: Request, res: Response): Promise<void> =>
    reply(res, orderItemService.update(getStoreId(req), req.params.id, req.params.itemId, req.body)),
  remove: (req: Request, res: Response): Promise<void> =>
    reply(res, orderItemService.remove(getStoreId(req), req.params.id, req.params.itemId)),
} as const;

export const statusController = {
  history: (req: Request, res: Response): Promise<void> =>
    reply(res, orderStatusHistoryService.list(getStoreId(req), req.params.id)),
  current: (req: Request, res: Response): Promise<void> =>
    reply(res, orderStatusHistoryService.currentStatus(getStoreId(req), req.params.id)),
} as const;

export const notesController = {
  create: (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    return replyCreated(
      res,
      orderNoteService.create(getStoreId(req), req.params.id, req.body, auth.mode === 'user' ? auth.userId : null),
    );
  },
  list: (req: Request, res: Response): Promise<void> =>
    reply(res, orderNoteService.list(getStoreId(req), req.params.id)),
  get: (req: Request, res: Response): Promise<void> =>
    reply(res, orderNoteService.getOwned(getStoreId(req), req.params.id, req.params.noteId)),
  update: (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    return reply(
      res,
      orderNoteService.update(getStoreId(req), req.params.id, req.params.noteId, req.body, {
        userId: auth.userId,
        role: auth.role,
      }),
    );
  },
  remove: (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    return replyDeleted(
      res,
      orderNoteService.remove(getStoreId(req), req.params.id, req.params.noteId, {
        userId: auth.userId,
        role: auth.role,
      }),
    );
  },
} as const;

/** Money-sensitive operations are restricted to OWNER/ADMIN at the route. */
export const refundsController = {
  create: (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    return replyCreated(res, orderRefundService.create(getStoreId(req), req.params.id, req.body, auth.userId));
  },
  list: (req: Request, res: Response): Promise<void> =>
    reply(res, orderRefundService.list(getStoreId(req), req.params.id)),
  get: (req: Request, res: Response): Promise<void> =>
    reply(res, orderRefundService.getOwned(getStoreId(req), req.params.id, req.params.refundId)),
  update: (req: Request, res: Response): Promise<void> =>
    reply(res, orderRefundService.update(getStoreId(req), req.params.id, req.params.refundId, req.body)),
  remove: (req: Request, res: Response): Promise<void> =>
    replyDeleted(res, orderRefundService.remove(getStoreId(req), req.params.id, req.params.refundId)),
  process: (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    return reply(
      res,
      orderRefundService.process(getStoreId(req), req.params.id, req.params.refundId, auth.userId).then((out) => ({
        refund: out.refund,
        order: out.order,
        orderRefunded: out.order.status === 'REFUNDED',
      })),
    );
  },
} as const;

export const cancellationsController = {
  create: (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    return replyCreated(res, orderCancellationService.create(getStoreId(req), req.params.id, req.body.reason, auth.userId));
  },
  list: (req: Request, res: Response): Promise<void> =>
    reply(res, orderCancellationService.list(getStoreId(req), req.params.id)),
  get: (req: Request, res: Response): Promise<void> =>
    reply(res, orderCancellationService.getOwned(getStoreId(req), req.params.id, req.params.cancellationId)),
  updateReason: (req: Request, res: Response): Promise<void> =>
    reply(res, orderCancellationService.updateReason(getStoreId(req), req.params.id, req.params.cancellationId, req.body.reason)),
  remove: (req: Request, res: Response): Promise<void> => {
    return replyDeleted(res, orderCancellationService.remove(getStoreId(req), req.params.id, req.params.cancellationId));
  },
  process: (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    return reply(res, orderCancellationService.process(getStoreId(req), req.params.id, req.params.cancellationId, auth.userId));
  },
} as const;

export const aiController = {
  predictFulfillment: (req: Request, res: Response): Promise<void> =>
    reply(res, orderAiService.predictFulfillment(getStoreId(req), req.params.id)),
  checkFraud: (req: Request, res: Response): Promise<void> =>
    reply(res, orderAiService.checkFraud(getStoreId(req), req.params.id)),
} as const;

/**
 * GET /orders/:id/timeline - one merged audit feed: status moves, notes,
 * refunds and the cancellation record, oldest first.
 */
export async function timeline(req: Request, res: Response): Promise<void> {
  const storeId = getStoreId(req);
  const orderId = req.params.id;
  const order = await requireOrderWithItems(storeId, orderId);
  const [history, notes, refunds, cancellations] = await Promise.all([
    orderStatusHistoryService.list(storeId, orderId),
    orderNoteService.list(storeId, orderId),
    orderRefundService.list(storeId, orderId),
    orderCancellationService.list(storeId, orderId),
  ]);

  type Event = { type: string; at: Date } & Record<string, unknown>;
  const events: Event[] = [
    ...history.map((h) => ({
      type: 'status',
      at: h.createdAt,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      reason: h.reason,
      actorId: h.actorId,
    })),
    ...notes.map((n) => ({
      type: 'note',
      at: n.createdAt,
      noteId: n.id,
      body: n.body,
      pinned: n.pinned,
      authorId: n.authorId,
    })),
    ...refunds.map((r) => ({
      type: 'refund',
      at: r.createdAt,
      refundId: r.id,
      amount: Number(r.amount),
      status: r.status,
    })),
  ];
  for (const c of cancellations) {
    events.push({ type: 'cancellation', at: c.createdAt, cancellationId: c.id, reason: c.reason });
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  sendSuccess(res, {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
    },
    itemCount: order.items.length,
    events,
  });
}

// ---------------------------------------------------------------------------
// Small response helpers (keep the controller table terse)
// ---------------------------------------------------------------------------

function reply(res: Response, data: Promise<unknown>): Promise<void> {
  return data.then((payload) => {
    sendSuccess(res, payload);
  });
}

function replyCreated(res: Response, data: Promise<unknown>): Promise<void> {
  return data.then((payload) => {
    sendSuccess(res, payload, undefined, 201);
  });
}

async function replyDeleted(res: Response, p: Promise<unknown>): Promise<void> {
  await p;
  sendSuccess(res, { deleted: true });
}

function reply422(res: Response, message: string): void {
  res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
}
