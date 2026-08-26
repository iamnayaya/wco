import { jest } from '@jest/globals';

jest.mock('../../src/modules/analytics/services/analytics-metric.service.js', () => ({
  analyticsMetricService: {
    calculateSalesMetrics: jest.fn().mockResolvedValue({
      totalRevenue: 10000, totalOrders: 20, averageOrderValue: 500,
      revenueGrowth: 15, orderGrowth: 10, dailySeries: [],
    }),
    calculateCustomerMetrics: jest.fn().mockResolvedValue({
      totalCustomers: 50, newCustomers: 5,
    }),
    calculateProductMetrics: jest.fn().mockResolvedValue({
      totalProducts: 30, topSelling: [],
    }),
    calculateMessageMetrics: jest.fn().mockResolvedValue({
      totalConversations: 200, aiResolved: 150,
    }),
    calculatePaymentMetrics: jest.fn().mockResolvedValue({
      totalPayments: 100, succeeded: 85,
    }),
    calculateDeliveryMetrics: jest.fn().mockResolvedValue({
      totalDeliveries: 80, delivered: 70,
    }),
  },
}));

import { AnalyticsReportService } from '../../src/modules/analytics/services/analytics-report.service.js';

function createMockDb() {
  return {
    analyticsReport: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
  };
}

describe('AnalyticsReportService', () => {
  let service: AnalyticsReportService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    service = new AnalyticsReportService(mockDb as never);
  });

  describe('generate', () => {
    it('creates and generates a SALES report', async () => {
      mockDb.analyticsReport.create.mockResolvedValue({
        id: 'rpt_1', storeId: 'store_1', reportType: 'SALES', status: 'GENERATING',
      });
      mockDb.analyticsReport.update.mockResolvedValue({
        id: 'rpt_1', status: 'COMPLETED', result: { totalRevenue: 10000 }, generatedAt: new Date(),
      });

      const result = await service.generate(
        'store_1', 'SALES', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z',
      );
      expect(result.status).toBe('COMPLETED');
      expect(mockDb.analyticsReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });

    it('creates and generates a COMPREHENSIVE report', async () => {
      mockDb.analyticsReport.create.mockResolvedValue({
        id: 'rpt_2', reportType: 'COMPREHENSIVE', status: 'GENERATING',
      });
      mockDb.analyticsReport.update.mockResolvedValue({
        id: 'rpt_2', status: 'COMPLETED', result: { sales: {}, customers: {} },
      });

      const result = await service.generate(
        'store_1', 'COMPREHENSIVE', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z',
      );
      expect(result.status).toBe('COMPLETED');
    });

    it('marks report as FAILED on error', async () => {
      mockDb.analyticsReport.create.mockResolvedValue({
        id: 'rpt_3', reportType: 'INVALID', status: 'GENERATING',
      });
      mockDb.analyticsReport.update.mockResolvedValue({
        id: 'rpt_3', status: 'FAILED', error: 'Unknown report type: INVALID',
      });

      const result = await service.generate(
        'store_1', 'INVALID' as never, '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z',
      );
      expect(result.status).toBe('FAILED');
    });

    it('rejects when dateFrom >= dateTo', async () => {
      await expect(
        service.generate('store_1', 'SALES', '2026-01-31T00:00:00Z', '2026-01-01T00:00:00Z'),
      ).rejects.toThrow();
    });
  });

  describe('schedule', () => {
    it('creates a scheduled report', async () => {
      mockDb.analyticsReport.create.mockResolvedValue({
        id: 'rpt_4', frequency: 'WEEKLY', status: 'PENDING',
      });
      const result = await service.schedule('store_1', 'SALES', 'WEEKLY');
      expect(result.frequency).toBe('WEEKLY');
      expect(result.status).toBe('PENDING');
    });
  });

  describe('list', () => {
    it('returns paginated reports', async () => {
      mockDb.analyticsReport.findMany.mockResolvedValue([{ id: 'rpt_1', reportType: 'SALES' }]);
      const result = await service.list('store_1', 1, 20);
      expect(result).toHaveLength(1);
    });

    it('applies filters', async () => {
      mockDb.analyticsReport.findMany.mockResolvedValue([]);
      await service.list('store_1', 1, 10, { reportType: 'PAYMENTS', status: 'COMPLETED' });
      expect(mockDb.analyticsReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ reportType: 'PAYMENTS', status: 'COMPLETED' }),
        }),
      );
    });
  });

  describe('count', () => {
    it('counts reports', async () => {
      mockDb.analyticsReport.count.mockResolvedValue(3);
      const count = await service.count('store_1', { status: 'COMPLETED' });
      expect(count).toBe(3);
    });
  });

  describe('getById', () => {
    it('returns report when found', async () => {
      mockDb.analyticsReport.findFirst.mockResolvedValue({ id: 'rpt_1', storeId: 'store_1' });
      const report = await service.getById('store_1', 'rpt_1');
      expect(report.id).toBe('rpt_1');
    });

    it('throws when not found', async () => {
      mockDb.analyticsReport.findFirst.mockResolvedValue(null);
      await expect(service.getById('store_1', 'missing')).rejects.toThrow();
    });
  });

  describe('cancelScheduled', () => {
    it('cancels a pending scheduled report', async () => {
      mockDb.analyticsReport.findFirst.mockResolvedValue({
        id: 'rpt_5', storeId: 'store_1', frequency: 'WEEKLY', status: 'PENDING',
      });
      mockDb.analyticsReport.update.mockResolvedValue({
        id: 'rpt_5', status: 'FAILED', error: 'Cancelled by user',
      });
      const result = await service.cancelScheduled('store_1', 'rpt_5');
      expect(result.status).toBe('FAILED');
    });

    it('throws when cancelling a one-time report', async () => {
      mockDb.analyticsReport.findFirst.mockResolvedValue({
        id: 'rpt_6', frequency: 'ONCE', status: 'PENDING',
      });
      await expect(service.cancelScheduled('store_1', 'rpt_6')).rejects.toThrow();
    });
  });
});
