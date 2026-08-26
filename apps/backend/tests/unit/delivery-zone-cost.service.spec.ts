import { DeliveryZoneService } from '../../src/modules/deliveries/services/delivery-zone.service.js';
import { DeliveryCostEngine } from '../../src/modules/deliveries/services/delivery-cost-engine.js';

/**
 * DeliveryZoneService unit tests — verifies point-in-polygon and
 * radius-based zone checks with mocked Prisma.
 */

const mockZoneDb = {
  deliveryZone: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
} as unknown as {
  deliveryZone: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
};

describe('DeliveryZoneService', () => {
  let service: DeliveryZoneService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeliveryZoneService(mockZoneDb as never);
  });

  describe('isPointInZone', () => {
    it('detects point inside a radius-based zone', async () => {
      mockZoneDb.deliveryZone.findFirst.mockResolvedValue({
        id: 'zone_1',
        type: 'RADIUS',
        centerLat: 6.45,
        centerLng: 3.40,
        radiusKm: 15,
        coordinates: [],
      });

      const result = await service.isPointInZone('store_1', 'zone_1', 6.46, 3.41);
      expect(result.inZone).toBe(true);
    });

    it('detects point outside a radius-based zone', async () => {
      mockZoneDb.deliveryZone.findFirst.mockResolvedValue({
        id: 'zone_1',
        type: 'RADIUS',
        centerLat: 6.45,
        centerLng: 3.40,
        radiusKm: 5,
        coordinates: [],
      });

      // ~30km away
      const result = await service.isPointInZone('store_1', 'zone_1', 6.70, 3.60);
      expect(result.inZone).toBe(false);
    });

    it('detects point inside a polygon zone', async () => {
      mockZoneDb.deliveryZone.findFirst.mockResolvedValue({
        id: 'zone_2',
        type: 'CUSTOM',
        coordinates: [
          [3.39, 6.44], // [lng, lat] pairs
          [3.43, 6.44],
          [3.43, 6.48],
          [3.39, 6.48],
          [3.39, 6.44],
        ],
      });

      const result = await service.isPointInZone('store_1', 'zone_2', 6.46, 3.41);
      expect(result.inZone).toBe(true);
    });

    it('detects point outside a polygon zone', async () => {
      mockZoneDb.deliveryZone.findFirst.mockResolvedValue({
        id: 'zone_2',
        type: 'CUSTOM',
        coordinates: [
          [3.39, 6.44],
          [3.43, 6.44],
          [3.43, 6.48],
          [3.39, 6.48],
          [3.39, 6.44],
        ],
      });

      // Point far outside the polygon
      const result = await service.isPointInZone('store_1', 'zone_2', 7.00, 4.00);
      expect(result.inZone).toBe(false);
    });
  });

  describe('create', () => {
    it('creates a delivery zone', async () => {
      mockZoneDb.deliveryZone.create.mockResolvedValue({
        id: 'zone_3',
        storeId: 'store_1',
        name: 'Test Zone',
        type: 'RADIUS',
        fee: 500,
      });

      const result = await service.create('store_1', {
        name: 'Test Zone',
        type: 'RADIUS',
        coordinates: [[3.40, 6.45]],
        centerLat: 6.45,
        centerLng: 3.40,
        radiusKm: 10,
        fee: 500,
      });

      expect(result.name).toBe('Test Zone');
      expect(result.fee).toBe(500);
    });
  });
});

/**
 * DeliveryCostEngine unit tests — verifies fee calculation with
 * distance, weight, insurance, and surge pricing.
 */

const mockCostDb = {
  deliveryRate: {
    findMany: jest.fn().mockResolvedValue([]),
  },
} as unknown as {
  deliveryRate: {
    findMany: jest.Mock;
  };
};

describe('DeliveryCostEngine', () => {
  let engine: DeliveryCostEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new DeliveryCostEngine(mockCostDb as never);
  });

  describe('calculate', () => {
    it('returns empty array when no rates available', async () => {
      const result = await engine.calculate({ distanceKm: 10 });
      expect(result).toEqual([]);
    });

    it('calculates cost with base fee and distance', async () => {
      mockCostDb.deliveryRate.findMany.mockResolvedValue([{
        id: 'rate_1',
        name: 'Standard',
        baseFee: 1500,
        perKmFee: 100,
        perKgFee: 0,
        minimumFee: 1500,
        maximumFee: null,
        freeThresholdKm: null,
        maxWeightKg: null,
        maxDimensionsCm: null,
        isActive: true,
        provider: { code: 'GIG', isActive: true },
      }]);

      const result = await engine.calculate({ distanceKm: 10 });
      expect(result).toHaveLength(1);
      expect(result[0].baseFee).toBe(1500);
      expect(result[0].distanceFee).toBe(1000);
      expect(result[0].totalFee).toBeGreaterThanOrEqual(2500);
      expect(result[0].provider).toBe('GIG');
    });

    it('applies weight fee', async () => {
      mockCostDb.deliveryRate.findMany.mockResolvedValue([{
        id: 'rate_2',
        name: 'Heavy',
        baseFee: 2000,
        perKmFee: 100,
        perKgFee: 50,
        minimumFee: 2000,
        maximumFee: null,
        freeThresholdKm: null,
        maxWeightKg: 50,
        maxDimensionsCm: null,
        isActive: true,
        provider: { code: 'KWIK', isActive: true },
      }]);

      const result = await engine.calculate({ distanceKm: 10, weight: 20 });
      expect(result[0].weightFee).toBe(1000);
      expect(result[0].totalFee).toBeGreaterThanOrEqual(4000);
    });

    it('applies insurance fee', async () => {
      mockCostDb.deliveryRate.findMany.mockResolvedValue([{
        id: 'rate_3',
        name: 'Standard',
        baseFee: 1500,
        perKmFee: 100,
        perKgFee: 0,
        minimumFee: 1500,
        maximumFee: null,
        freeThresholdKm: null,
        maxWeightKg: null,
        maxDimensionsCm: null,
        isActive: true,
        provider: { code: 'GIG', isActive: true },
      }]);

      const result = await engine.calculate({ distanceKm: 10, insuranceAmount: 50000 });
      expect(result[0].insuranceFee).toBe(500); // 1% of 50000
    });

    it('enforces maximum fee cap', async () => {
      mockCostDb.deliveryRate.findMany.mockResolvedValue([{
        id: 'rate_4',
        name: 'Capped',
        baseFee: 1500,
        perKmFee: 100,
        perKgFee: 0,
        minimumFee: 1500,
        maximumFee: 3000,
        freeThresholdKm: null,
        maxWeightKg: null,
        maxDimensionsCm: null,
        isActive: true,
        provider: { code: 'GIG', isActive: true },
      }]);

      const result = await engine.calculate({ distanceKm: 50 });
      expect(result[0].totalFee).toBeLessThanOrEqual(3000);
    });

    it('skips rates exceeding weight limit', async () => {
      mockCostDb.deliveryRate.findMany.mockResolvedValue([{
        id: 'rate_5',
        name: 'Light Only',
        baseFee: 1000,
        perKmFee: 100,
        perKgFee: 0,
        minimumFee: 1000,
        maximumFee: null,
        freeThresholdKm: null,
        maxWeightKg: 5,
        maxDimensionsCm: null,
        isActive: true,
        provider: { code: 'GIG', isActive: true },
      }]);

      const result = await engine.calculate({ distanceKm: 10, weight: 10 });
      expect(result).toHaveLength(0); // weight exceeds limit
    });

    it('sorts results by total fee ascending', async () => {
      mockCostDb.deliveryRate.findMany.mockResolvedValue([
        {
          id: 'rate_a', name: 'Expensive', baseFee: 5000, perKmFee: 200, perKgFee: 0,
          minimumFee: 5000, maximumFee: null, freeThresholdKm: null, maxWeightKg: null,
          maxDimensionsCm: null, isActive: true, provider: { code: 'GIG', isActive: true },
        },
        {
          id: 'rate_b', name: 'Cheap', baseFee: 1000, perKmFee: 50, perKgFee: 0,
          minimumFee: 1000, maximumFee: null, freeThresholdKm: null, maxWeightKg: null,
          maxDimensionsCm: null, isActive: true, provider: { code: 'KWIK', isActive: true },
        },
      ]);

      const result = await engine.calculate({ distanceKm: 10 });
      expect(result[0].rateName).toBe('Cheap');
      expect(result[1].rateName).toBe('Expensive');
    });
  });

  describe('applyDiscount', () => {
    it('applies percentage discount', async () => {
      mockCostDb.deliveryRate.findMany.mockResolvedValue([]);
      const breakdown = {
        baseFee: 1000, distanceFee: 500, weightFee: 0, insuranceFee: 0,
        surgeMultiplier: 1, discount: 0, totalFee: 1500, currency: 'NGN',
        provider: 'GIG', rateName: 'Standard', etaMinutes: 30,
      };

      const result = engine.applyDiscount(breakdown, 10);
      expect(result.discount).toBe(150);
      expect(result.totalFee).toBe(1350);
    });
  });

  describe('applyFlatDiscount', () => {
    it('applies flat discount', async () => {
      mockCostDb.deliveryRate.findMany.mockResolvedValue([]);
      const breakdown = {
        baseFee: 1000, distanceFee: 500, weightFee: 0, insuranceFee: 0,
        surgeMultiplier: 1, discount: 0, totalFee: 1500, currency: 'NGN',
        provider: 'GIG', rateName: 'Standard', etaMinutes: 30,
      };

      const result = engine.applyFlatDiscount(breakdown, 200);
      expect(result.discount).toBe(200);
      expect(result.totalFee).toBe(1300);
    });

    it('does not go below zero', async () => {
      mockCostDb.deliveryRate.findMany.mockResolvedValue([]);
      const breakdown = {
        baseFee: 500, distanceFee: 0, weightFee: 0, insuranceFee: 0,
        surgeMultiplier: 1, discount: 0, totalFee: 500, currency: 'NGN',
        provider: 'GIG', rateName: 'Standard', etaMinutes: 30,
      };

      const result = engine.applyFlatDiscount(breakdown, 1000);
      expect(result.totalFee).toBe(0);
    });
  });
});
