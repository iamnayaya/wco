import {
  trackEventSchema,
  trackEventsBatchSchema,
  listEventsQuerySchema,
  aggregateEventsQuerySchema,
  metricsQuerySchema,
  topProductsQuerySchema,
  dailyMetricsQuerySchema,
  generateReportSchema,
  scheduleReportSchema,
  listReportsQuerySchema,
  reportIdParams,
  createDashboardSchema,
  updateDashboardSchema,
  dashboardIdParams,
  addWidgetSchema,
  updateWidgetSchema,
  generateInsightsSchema,
  listInsightsQuerySchema,
  insightIdParams,
  actOnInsightSchema,
  exportMetricsSchema,
  customerMetricsQuerySchema,
  productMetricsQuerySchema,
  messageMetricsQuerySchema,
  paymentMetricsQuerySchema,
  deliveryMetricsQuerySchema,
} from '../../src/modules/analytics/analytics.dto.js';

describe('Analytics DTOs', () => {
  // ─── Events ───────────────────────────────────────────────────

  describe('trackEventSchema', () => {
    it('accepts valid event', () => {
      const result = trackEventSchema.parse({ type: 'page.view' });
      expect(result.type).toBe('page.view');
      expect(result.props).toEqual({});
    });

    it('accepts all optional fields', () => {
      const result = trackEventSchema.parse({
        type: 'product.add_to_cart',
        props: { productId: 'p_123', quantity: 2 },
        customerId: 'cust_abc',
        sessionId: 'sess_xyz',
        timestamp: '2026-01-15T10:30:00Z',
      });
      expect(result.props).toEqual({ productId: 'p_123', quantity: 2 });
    });

    it('rejects short type', () => {
      expect(() => trackEventSchema.parse({ type: 'ab' })).toThrow();
    });

    it('rejects invalid type format (must be lowercase)', () => {
      expect(() => trackEventSchema.parse({ type: 'PageView' })).toThrow();
    });

    it('rejects too many props', () => {
      const props: Record<string, number> = {};
      for (let i = 0; i < 51; i++) props[`key${i}`] = i;
      expect(() => trackEventSchema.parse({ type: 'test.event', props })).toThrow();
    });
  });

  describe('trackEventsBatchSchema', () => {
    it('accepts valid batch', () => {
      const result = trackEventsBatchSchema.parse({
        events: [{ type: 'test.a' }, { type: 'test.b' }],
      });
      expect(result.events).toHaveLength(2);
    });

    it('rejects empty batch', () => {
      expect(() => trackEventsBatchSchema.parse({ events: [] })).toThrow();
    });
  });

  describe('listEventsQuerySchema', () => {
    it('uses defaults', () => {
      const result = listEventsQuerySchema.parse({});
      expect(result.sortBy).toBe('occurredAt');
      expect(result.sortOrder).toBe('desc');
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('accepts all filters', () => {
      const result = listEventsQuerySchema.parse({
        type: 'order.created',
        customerId: 'cust_1',
        sessionId: 'sess_1',
        dateFrom: '2026-01-01T00:00:00Z',
        dateTo: '2026-01-31T23:59:59Z',
        sortBy: 'type',
        sortOrder: 'asc',
        page: 2,
        pageSize: 50,
      });
      expect(result.type).toBe('order.created');
      expect(result.page).toBe(2);
    });
  });

  describe('aggregateEventsQuerySchema', () => {
    it('accepts valid query', () => {
      const result = aggregateEventsQuerySchema.parse({ type: 'button.click' });
      expect(result.aggregation).toBe('count');
      expect(result.granularity).toBe('daily');
    });

    it('rejects missing type', () => {
      expect(() => aggregateEventsQuerySchema.parse({})).toThrow();
    });
  });

  // ─── Metrics ──────────────────────────────────────────────────

  describe('metricsQuerySchema', () => {
    it('uses defaults', () => {
      const result = metricsQuerySchema.parse({});
      expect(result.granularity).toBe('daily');
    });

    it('accepts date range', () => {
      const result = metricsQuerySchema.parse({
        dateFrom: '2026-01-01T00:00:00Z',
        dateTo: '2026-01-31T23:59:59Z',
      });
      expect(result.dateFrom).toBe('2026-01-01T00:00:00Z');
    });
  });

  describe('topProductsQuerySchema', () => {
    it('uses defaults', () => {
      const result = topProductsQuerySchema.parse({});
      expect(result.days).toBe(30);
      expect(result.limit).toBe(10);
      expect(result.sortBy).toBe('quantity');
    });

    it('accepts custom values', () => {
      const result = topProductsQuerySchema.parse({ days: 7, limit: 5, sortBy: 'revenue' });
      expect(result.days).toBe(7);
      expect(result.sortBy).toBe('revenue');
    });
  });

  describe('dailyMetricsQuerySchema', () => {
    it('uses default', () => {
      expect(dailyMetricsQuerySchema.parse({}).days).toBe(30);
    });

    it('accepts custom days', () => {
      expect(dailyMetricsQuerySchema.parse({ days: 90 }).days).toBe(90);
    });

    it('rejects > 365', () => {
      expect(() => dailyMetricsQuerySchema.parse({ days: 366 })).toThrow();
    });
  });

  describe('customerMetricsQuerySchema', () => {
    it('accepts empty', () => {
      expect(customerMetricsQuerySchema.parse({})).toEqual({});
    });

    it('accepts segmentBy', () => {
      const result = customerMetricsQuerySchema.parse({ segmentBy: 'ltv' });
      expect(result.segmentBy).toBe('ltv');
    });
  });

  describe('productMetricsQuerySchema', () => {
    it('accepts empty', () => {
      expect(productMetricsQuerySchema.parse({})).toEqual({});
    });
  });

  describe('messageMetricsQuerySchema', () => {
    it('uses defaults', () => {
      const result = messageMetricsQuerySchema.parse({});
      expect(result.groupBy).toBe('day');
    });
  });

  describe('paymentMetricsQuerySchema', () => {
    it('accepts provider filter', () => {
      const result = paymentMetricsQuerySchema.parse({ provider: 'PAYSTACK' });
      expect(result.provider).toBe('PAYSTACK');
    });

    it('rejects invalid provider', () => {
      expect(() => paymentMetricsQuerySchema.parse({ provider: 'STRIPE' })).toThrow();
    });
  });

  describe('deliveryMetricsQuerySchema', () => {
    it('accepts carrier filter', () => {
      const result = deliveryMetricsQuerySchema.parse({ carrier: 'GIG' });
      expect(result.carrier).toBe('GIG');
    });
  });

  describe('exportMetricsSchema', () => {
    it('accepts valid export request', () => {
      const result = exportMetricsSchema.parse({ metrics: ['revenue', 'orders'] });
      expect(result.format).toBe('csv');
      expect(result.metrics).toHaveLength(2);
    });

    it('rejects empty metrics', () => {
      expect(() => exportMetricsSchema.parse({ metrics: [] })).toThrow();
    });
  });

  // ─── Reports ──────────────────────────────────────────────────

  describe('reportIdParams', () => {
    it('accepts valid id', () => {
      expect(reportIdParams.parse({ id: 'rpt_123' })).toEqual({ id: 'rpt_123' });
    });
    it('rejects empty id', () => {
      expect(() => reportIdParams.parse({ id: '' })).toThrow();
    });
  });

  describe('generateReportSchema', () => {
    it('accepts valid request', () => {
      const result = generateReportSchema.parse({
        reportType: 'SALES',
        dateFrom: '2026-01-01T00:00:00Z',
        dateTo: '2026-01-31T23:59:59Z',
      });
      expect(result.reportType).toBe('SALES');
      expect(result.format).toBe('JSON');
    });

    it('rejects invalid reportType', () => {
      expect(() => generateReportSchema.parse({
        reportType: 'INVALID',
        dateFrom: '2026-01-01T00:00:00Z',
        dateTo: '2026-01-31T23:59:59Z',
      })).toThrow();
    });

    it('rejects missing dateFrom', () => {
      expect(() => generateReportSchema.parse({
        reportType: 'SALES',
        dateTo: '2026-01-31T23:59:59Z',
      })).toThrow();
    });
  });

  describe('scheduleReportSchema', () => {
    it('accepts valid schedule', () => {
      const result = scheduleReportSchema.parse({
        reportType: 'COMPREHENSIVE',
        frequency: 'WEEKLY',
      });
      expect(result.frequency).toBe('WEEKLY');
      expect(result.format).toBe('JSON');
    });

    it('rejects invalid frequency', () => {
      expect(() => scheduleReportSchema.parse({
        reportType: 'SALES',
        frequency: 'HOURLY',
      })).toThrow();
    });
  });

  describe('listReportsQuerySchema', () => {
    it('uses defaults', () => {
      const result = listReportsQuerySchema.parse({});
      expect(result.sortBy).toBe('createdAt');
      expect(result.page).toBe(1);
    });

    it('accepts all filters', () => {
      const result = listReportsQuerySchema.parse({
        reportType: 'PAYMENTS',
        status: 'COMPLETED',
        sortBy: 'generatedAt',
        sortOrder: 'asc',
      });
      expect(result.status).toBe('COMPLETED');
    });
  });

  // ─── Dashboards ───────────────────────────────────────────────

  describe('dashboardIdParams', () => {
    it('accepts valid id', () => {
      expect(dashboardIdParams.parse({ id: 'dash_123' })).toEqual({ id: 'dash_123' });
    });
    it('rejects empty id', () => {
      expect(() => dashboardIdParams.parse({ id: '' })).toThrow();
    });
  });

  describe('createDashboardSchema', () => {
    it('accepts minimal dashboard', () => {
      const result = createDashboardSchema.parse({ name: 'My Dashboard' });
      expect(result.name).toBe('My Dashboard');
      expect(result.isDefault).toBe(false);
    });

    it('accepts with widgets', () => {
      const result = createDashboardSchema.parse({
        name: 'Sales Dashboard',
        widgets: [
          { widgetType: 'line_chart', title: 'Revenue', config: { metric: 'revenue' } },
          { widgetType: 'kpi_card', title: 'Orders' },
        ],
      });
      expect(result.widgets).toHaveLength(2);
    });

    it('rejects too many widgets', () => {
      expect(() => createDashboardSchema.parse({
        name: 'X',
        widgets: Array(21).fill({ widgetType: 'kpi', title: 'W' }),
      })).toThrow();
    });
  });

  describe('updateDashboardSchema', () => {
    it('accepts partial update', () => {
      const result = updateDashboardSchema.parse({ name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('accepts empty update', () => {
      expect(updateDashboardSchema.parse({})).toEqual({});
    });
  });

  describe('addWidgetSchema', () => {
    it('accepts valid widget', () => {
      const result = addWidgetSchema.parse({
        widgetType: 'bar_chart',
        title: 'Sales by Category',
      });
      expect(result.widgetType).toBe('bar_chart');
      expect(result.refreshSecs).toBe(300);
    });

    it('rejects missing widgetType', () => {
      expect(() => addWidgetSchema.parse({ title: 'X' })).toThrow();
    });
  });

  describe('updateWidgetSchema', () => {
    it('accepts partial update', () => {
      const result = updateWidgetSchema.parse({ title: 'New Title' });
      expect(result.title).toBe('New Title');
    });

    it('accepts empty update', () => {
      expect(updateWidgetSchema.parse({})).toEqual({});
    });
  });

  // ─── Insights ─────────────────────────────────────────────────

  describe('insightIdParams', () => {
    it('accepts valid id', () => {
      expect(insightIdParams.parse({ id: 'ins_123' })).toEqual({ id: 'ins_123' });
    });
    it('rejects empty id', () => {
      expect(() => insightIdParams.parse({ id: '' })).toThrow();
    });
  });

  describe('generateInsightsSchema', () => {
    it('accepts empty body', () => {
      expect(generateInsightsSchema.parse({})).toEqual({});
    });

    it('accepts type filter', () => {
      const result = generateInsightsSchema.parse({
        types: ['TREND', 'ANOMALY'],
      });
      expect(result.types).toEqual(['TREND', 'ANOMALY']);
    });
  });

  describe('listInsightsQuerySchema', () => {
    it('uses defaults', () => {
      const result = listInsightsQuerySchema.parse({});
      expect(result.status).toBe('ACTIVE');
      expect(result.page).toBe(1);
    });

    it('accepts all filters', () => {
      const result = listInsightsQuerySchema.parse({
        insightType: 'RISK',
        severity: 'HIGH',
        status: 'DISMISSED',
        sortBy: 'severity',
        sortOrder: 'asc',
      });
      expect(result.severity).toBe('HIGH');
      expect(result.sortOrder).toBe('asc');
    });

    it('rejects invalid insightType', () => {
      expect(() => listInsightsQuerySchema.parse({ insightType: 'INVALID' })).toThrow();
    });
  });

  describe('actOnInsightSchema', () => {
    it('accepts valid action', () => {
      const result = actOnInsightSchema.parse({ action: 'IMPLEMENT_PRICING' });
      expect(result.action).toBe('IMPLEMENT_PRICING');
    });

    it('accepts with note', () => {
      const result = actOnInsightSchema.parse({
        action: 'DECREASE_PRICE',
        note: 'Will test for 2 weeks',
      });
      expect(result.note).toBe('Will test for 2 weeks');
    });

    it('rejects missing action', () => {
      expect(() => actOnInsightSchema.parse({})).toThrow();
    });
  });
});
