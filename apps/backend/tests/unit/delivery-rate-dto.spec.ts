import {
  deliveryRateIdParams,
  deliveryProviderIdParam,
  createDeliveryRateSchema,
  updateDeliveryRateSchema,
  calculateRateSchema,
} from '../../src/modules/deliveries/delivery-rate.dto.js';

describe('Delivery Rate DTOs', () => {
  describe('deliveryRateIdParams', () => {
    it('accepts valid id', () => {
      expect(deliveryRateIdParams.parse({ id: 'dr_123' })).toEqual({ id: 'dr_123' });
    });
    it('rejects empty id', () => {
      expect(() => deliveryRateIdParams.parse({ id: '' })).toThrow();
    });
  });

  describe('deliveryProviderIdParam', () => {
    it('accepts valid provider id', () => {
      expect(deliveryProviderIdParam.parse({ providerId: 'dp_456' })).toEqual({ providerId: 'dp_456' });
    });
    it('rejects missing providerId', () => {
      expect(() => deliveryProviderIdParam.parse({})).toThrow();
    });
  });

  describe('createDeliveryRateSchema', () => {
    it('accepts valid rate', () => {
      const result = createDeliveryRateSchema.parse({
        name: 'Standard',
        baseFee: 1500,
      });
      expect(result.name).toBe('Standard');
      expect(result.baseFee).toBe(1500);
      expect(result.perKmFee).toBe(0);
      expect(result.perKgFee).toBe(0);
      expect(result.minimumFee).toBe(0);
      expect(result.isActive).toBe(true);
    });

    it('accepts all optional fields', () => {
      const result = createDeliveryRateSchema.parse({
        name: 'Express',
        baseFee: 3000,
        perKmFee: 200,
        perKgFee: 50,
        minimumFee: 2000,
        maximumFee: 15000,
        freeThresholdKm: 5,
        avgEtaMinutes: 30,
        maxWeightKg: 30,
        maxDimensionsCm: 200,
        meta: { priority: true },
      });
      expect(result.perKmFee).toBe(200);
      expect(result.maximumFee).toBe(15000);
    });

    it('rejects missing name', () => {
      expect(() => createDeliveryRateSchema.parse({ baseFee: 1000 })).toThrow();
    });

    it('rejects negative baseFee', () => {
      expect(() => createDeliveryRateSchema.parse({ name: 'X', baseFee: -500 })).toThrow();
    });
  });

  describe('updateDeliveryRateSchema', () => {
    it('accepts partial update', () => {
      const result = updateDeliveryRateSchema.parse({ baseFee: 2000 });
      expect(result.baseFee).toBe(2000);
    });

    it('accepts empty update', () => {
      expect(updateDeliveryRateSchema.parse({})).toEqual({});
    });
  });

  describe('calculateRateSchema', () => {
    it('accepts valid calculation request', () => {
      const result = calculateRateSchema.parse({
        pickupAddress: '123 Lagos Street',
        dropoffAddress: '456 Abuja Road',
      });
      expect(result.pickupAddress).toBe('123 Lagos Street');
    });

    it('accepts optional weight and dimensions', () => {
      const result = calculateRateSchema.parse({
        pickupAddress: 'Lagos',
        dropoffAddress: 'Abuja',
        weight: 10,
        length: 50,
        width: 30,
        height: 20,
      });
      expect(result.weight).toBe(10);
      expect(result.length).toBe(50);
    });
  });
});
