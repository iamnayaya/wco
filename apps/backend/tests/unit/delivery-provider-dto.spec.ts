import {
  createDeliveryProviderSchema,
  updateDeliveryProviderSchema,
  deliveryProviderIdParams,
  listDeliveryProvidersQuerySchema,
  availableProvidersQuerySchema,
} from '../../src/modules/deliveries/delivery-provider.dto.js';

describe('Delivery Provider DTOs', () => {
  describe('deliveryProviderIdParams', () => {
    it('accepts valid id', () => {
      expect(deliveryProviderIdParams.parse({ id: 'dp_abc123' })).toEqual({ id: 'dp_abc123' });
    });
    it('rejects empty id', () => {
      expect(() => deliveryProviderIdParams.parse({ id: '' })).toThrow();
    });
  });

  describe('createDeliveryProviderSchema', () => {
    it('accepts valid provider', () => {
      const result = createDeliveryProviderSchema.parse({
        code: 'GIG',
        name: 'GIG Logistics',
        countries: ['NG'],
        baseFee: 1500,
      });
      expect(result.code).toBe('GIG');
      expect(result.baseFee).toBe(1500);
      expect(result.perKmFee).toBe(0);
      expect(result.cities).toEqual([]);
      expect(result.isActive).toBe(true);
    });

    it('accepts all optional fields', () => {
      const result = createDeliveryProviderSchema.parse({
        code: 'KWIK',
        name: 'Kwik Delivery',
        countries: ['NG', 'GH'],
        cities: ['Lagos', 'Accra'],
        baseFee: 2000,
        perKmFee: 150,
        avgEtaMinutes: 45,
        webhookSecret: 'my-super-secret-webhook-key-12345',
        isActive: true,
        meta: { maxWeightKg: 30 },
      });
      expect(result.countries).toEqual(['NG', 'GH']);
      expect(result.perKmFee).toBe(150);
    });

    it('rejects missing code', () => {
      expect(() => createDeliveryProviderSchema.parse({ name: 'Test', baseFee: 1000 })).toThrow();
    });

    it('rejects negative baseFee', () => {
      expect(() => createDeliveryProviderSchema.parse({
        code: 'X', name: 'X', baseFee: -100,
      })).toThrow();
    });

    it('rejects empty countries array', () => {
      expect(() => createDeliveryProviderSchema.parse({
        code: 'X', name: 'X', baseFee: 100, countries: [],
      })).toThrow();
    });
  });

  describe('updateDeliveryProviderSchema', () => {
    it('accepts partial update', () => {
      const result = updateDeliveryProviderSchema.parse({ name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('accepts empty update', () => {
      expect(updateDeliveryProviderSchema.parse({})).toEqual({});
    });

    it('does not allow code update', () => {
      const result = updateDeliveryProviderSchema.parse({ name: 'X' });
      expect(result).not.toHaveProperty('code');
    });
  });

  describe('listDeliveryProvidersQuerySchema', () => {
    it('uses defaults', () => {
      const result = listDeliveryProvidersQuerySchema.parse({});
      expect(result).toEqual({ page: 1, pageSize: 20 });
    });

    it('accepts isActive filter', () => {
      const result = listDeliveryProvidersQuerySchema.parse({ isActive: 'true' });
      expect(result.isActive).toBe(true);
    });

    it('accepts country filter', () => {
      const result = listDeliveryProvidersQuerySchema.parse({ country: 'GH' });
      expect(result.country).toBe('GH');
    });
  });

  describe('availableProvidersQuerySchema', () => {
    it('accepts valid query', () => {
      const result = availableProvidersQuerySchema.parse({
        pickupAddress: '123 Lagos Street',
        dropoffAddress: '456 Abuja Road',
      });
      expect(result.pickupAddress).toBe('123 Lagos Street');
    });

    it('accepts weight and dimensions', () => {
      const result = availableProvidersQuerySchema.parse({
        pickupAddress: 'Lagos',
        dropoffAddress: 'Abuja',
        weight: 5,
        length: 30,
        width: 20,
        height: 15,
      });
      expect(result.weight).toBe(5);
    });

    it('rejects short address', () => {
      expect(() => availableProvidersQuerySchema.parse({
        pickupAddress: 'Lag',
        dropoffAddress: 'Abuja',
      })).toThrow();
    });
  });
});
