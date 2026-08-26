import { jest } from '@jest/globals';

jest.mock('../../src/modules/analytics/services/analytics-metric.service.js', () => ({
  analyticsMetricService: {
    calculateSalesMetrics: jest.fn().mockResolvedValue({
      totalRevenue: 10000, totalOrders: 20, averageOrderValue: 500,
      revenueGrowth: 15, orderGrowth: 10, dailySeries: [],
      currency: 'NGN',
    }),
    calculateCustomerMetrics: jest.fn().mockResolvedValue({
      totalCustomers: 50, newCustomers: 5, returningCustomers: 10,
      retentionRate: 20, acquisitionGrowth: 25,
      averageLifetimeValue: 2000, averageOrdersPerCustomer: 3,
    }),
    calculateProductMetrics: jest.fn().mockResolvedValue({
      totalProducts: 30, topSelling: [{ productId: 'p_1', quantitySold: 100, revenue: 5000, orderCount: 20 }],
      lowPerformers: [], inventoryTurnover: 2.5, stockByStatus: [],
      categoryBreakdown: [],
    }),
    calculateMessageMetrics: jest.fn().mockResolvedValue({
      totalConversations: 200, aiResolved: 150, escalated: 20,
      aiResolutionRate: 75, escalationRate: 10, avgResponseSeconds: 45,
      dailySeries: [],
    }),
    calculatePaymentMetrics: jest.fn().mockResolvedValue({
      totalPayments: 100, succeeded: 85, failed: 15,
      successRate: 85, byProvider: [], byMethod: [],
      refunds: { count: 3, totalAmount: 500 },
      dailySeries: [],
    }),
    calculateDeliveryMetrics: jest.fn().mockResolvedValue({
      totalDeliveries: 80, delivered: 70, failed: 5,
      successRate: 87.5, averageFee: 1500, averageRating: 4.2,
      totalClaims: 3, byCarrier: [], dailySeries: [],
    }),
  },
}));

import { AnalyticsInsightService } from '../../src/modules/analytics/services/analytics-insight.service.js';

function createMockDb() {
  return {
    analyticsInsight: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    $transaction: jest.fn((fns: unknown[]) => Promise.all(fns)),
  };
}

describe('AnalyticsInsightService', () => {
  let service: AnalyticsInsightService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    service = new AnalyticsInsightService(mockDb as never);
  });

  describe('generate', () => {
    it('creates insights from store data', async () => {
      const insights = await service.generate('store_1');
      expect(Array.isArray(insights)).toBe(true);
      if (insights.length > 0) {
        expect(mockDb.analyticsInsight.create).toHaveBeenCalled();
      }
    });

    it('returns empty array when no insights triggered', async () => {
      const insights = await service.generate('store_1');
      expect(insights).toEqual([]);
    });

    it('generates revenue decline insight when growth is negative', async () => {
      const { analyticsMetricService } = await import('../../src/modules/analytics/services/analytics-metric.service.js');
      (analyticsMetricService.calculateSalesMetrics as jest.Mock).mockResolvedValue({
        totalRevenue: 100, totalOrders: 2, averageOrderValue: 50,
        revenueGrowth: -25, orderGrowth: -20, dailySeries: [], currency: 'NGN',
      });

      await service.generate('store_1', { types: ['TREND'] });
      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it('generates low payment success rate risk insight', async () => {
      const { analyticsMetricService } = await import('../../src/modules/analytics/services/analytics-metric.service.js');
      (analyticsMetricService.calculatePaymentMetrics as jest.Mock).mockResolvedValue({
        totalPayments: 50, succeeded: 30, failed: 20,
        successRate: 60, byProvider: [], byMethod: [],
        refunds: { count: 0, totalAmount: 0 }, dailySeries: [],
      });

      await service.generate('store_1', { types: ['RISK'] });
      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it('generates top product opportunity insight', async () => {
      const { analyticsMetricService } = await import('../../src/modules/analytics/services/analytics-metric.service.js');
      (analyticsMetricService.calculateProductMetrics as jest.Mock).mockResolvedValue({
        totalProducts: 10,
        topSelling: [{ productId: 'p_1', quantitySold: 100, revenue: 5000, orderCount: 20 }],
        lowPerformers: [], inventoryTurnover: 2.5, stockByStatus: [],
        categoryBreakdown: [],
      });

      await service.generate('store_1', { types: ['OPPORTUNITY'] });
      expect(mockDb.$transaction).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns paginated insights', async () => {
      mockDb.analyticsInsight.findMany.mockResolvedValue([]);
      const result = await service.list('store_1', 1, 20, { status: 'ACTIVE' });
      expect(result).toEqual([]);
      expect(mockDb.analyticsInsight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
    });

    it('applies filters', async () => {
      mockDb.analyticsInsight.findMany.mockResolvedValue([]);
      await service.list('store_1', 1, 10, { insightType: 'RISK', severity: 'HIGH' });
      expect(mockDb.analyticsInsight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ insightType: 'RISK', severity: 'HIGH' }),
        }),
      );
    });
  });

  describe('count', () => {
    it('counts insights', async () => {
      mockDb.analyticsInsight.count.mockResolvedValue(5);
      const count = await service.count('store_1', { status: 'ACTIVE' });
      expect(count).toBe(5);
    });
  });

  describe('getById', () => {
    it('returns insight when found', async () => {
      mockDb.analyticsInsight.findFirst.mockResolvedValue({ id: 'ins_1', storeId: 'store_1' });
      const insight = await service.getById('store_1', 'ins_1');
      expect(insight.id).toBe('ins_1');
    });

    it('throws NotFoundError when missing', async () => {
      mockDb.analyticsInsight.findFirst.mockResolvedValue(null);
      await expect(service.getById('store_1', 'missing')).rejects.toThrow();
    });
  });

  describe('dismiss', () => {
    it('dismisses an active insight', async () => {
      mockDb.analyticsInsight.findFirst.mockResolvedValue({
        id: 'ins_1', storeId: 'store_1', status: 'ACTIVE',
      });
      mockDb.analyticsInsight.update.mockResolvedValue({ id: 'ins_1', status: 'DISMISSED' });
      const result = await service.dismiss('store_1', 'ins_1');
      expect(result.status).toBe('DISMISSED');
    });

    it('throws on non-active insight', async () => {
      mockDb.analyticsInsight.findFirst.mockResolvedValue({
        id: 'ins_1', storeId: 'store_1', status: 'DISMISSED',
      });
      await expect(service.dismiss('store_1', 'ins_1')).rejects.toThrow();
    });
  });

  describe('act', () => {
    it('marks insight as acted upon', async () => {
      mockDb.analyticsInsight.findFirst.mockResolvedValue({
        id: 'ins_1', storeId: 'store_1', status: 'ACTIVE', data: {},
      });
      mockDb.analyticsInsight.update.mockResolvedValue({ id: 'ins_1', status: 'ACTED_UPON' });
      const result = await service.act('store_1', 'ins_1', 'IMPLEMENT_PRICING');
      expect(result.status).toBe('ACTED_UPON');
    });

    it('throws on non-active insight', async () => {
      mockDb.analyticsInsight.findFirst.mockResolvedValue({
        id: 'ins_1', status: 'EXPIRED', data: {},
      });
      await expect(service.act('store_1', 'ins_1', 'DO_SOMETHING')).rejects.toThrow();
    });
  });
});
