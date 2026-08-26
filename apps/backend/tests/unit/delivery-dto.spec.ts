import {
  deliveryIdParams,
  createDeliverySchema,
  updateDeliverySchema,
  listDeliveriesQuerySchema,
  calculateCostSchema,
  cancelDeliverySchema,
  rateDeliverySchema,
} from '../../src/modules/deliveries/delivery.dto.js';

describe('Delivery DTOs', () => {
  describe('deliveryIdParams', () => {
    it('accepts valid id', () => {
      expect(deliveryIdParams.parse({ id: 'del_abc' })).toEqual({ id: 'del_abc' });
    });
    it('rejects empty id', () => {
      expect(() => deliveryIdParams.parse({ id: '' })).toThrow();
    });
  });

  describe('createDeliverySchema', () => {
    it('accepts minimal valid delivery', () => {
      const result = createDeliverySchema.parse({
        orderId: 'ord_123',
        pickupAddress: '123 Ikeja GRA, Lagos',
        dropoffAddress: '456 Victoria Island, Lagos',
        recipientPhone: '+2348012345678',
      });
      expect(result.carrier).toBe('MANUAL');
      expect(result.recipientPhone).toBe('+2348012345678');
    });

    it('accepts all optional fields', () => {
      const result = createDeliverySchema.parse({
        orderId: 'ord_123',
        deliveryProviderId: 'dp_gig',
        carrier: 'GIG',
        pickupAddress: '123 Ikeja GRA, Lagos',
        pickupLat: 6.6018,
        pickupLng: 3.3515,
        dropoffAddress: '456 Victoria Island, Lagos',
        dropoffLat: 6.4281,
        dropoffLng: 3.4219,
        recipientName: 'John Doe',
        recipientPhone: '+2348012345678',
        packageDescription: 'Electronics',
        packageWeightKg: 2.5,
        packageLengthCm: 30,
        packageWidthCm: 20,
        packageHeightCm: 15,
        insuranceAmount: 5000,
        codAmount: 15000,
      });
      expect(result.carrier).toBe('GIG');
      expect(result.packageWeightKg).toBe(2.5);
      expect(result.codAmount).toBe(15000);
    });

    it('rejects missing orderId', () => {
      expect(() => createDeliverySchema.parse({
        pickupAddress: 'Lagos',
        dropoffAddress: 'Abuja',
        recipientPhone: '+2348012345678',
      })).toThrow();
    });

    it('rejects invalid carrier', () => {
      expect(() => createDeliverySchema.parse({
        orderId: 'ord_1',
        carrier: 'DHL',
        pickupAddress: 'Lagos',
        dropoffAddress: 'Abuja',
        recipientPhone: '+2348012345678',
      })).toThrow();
    });

    it('rejects negative weight', () => {
      expect(() => createDeliverySchema.parse({
        orderId: 'ord_1',
        pickupAddress: 'Lagos',
        dropoffAddress: 'Abuja',
        recipientPhone: '+2348012345678',
        packageWeightKg: -5,
      })).toThrow();
    });
  });

  describe('updateDeliverySchema', () => {
    it('accepts partial update', () => {
      const result = updateDeliverySchema.parse({ recipientName: 'Jane' });
      expect(result.recipientName).toBe('Jane');
    });

    it('accepts empty update', () => {
      expect(updateDeliverySchema.parse({})).toEqual({});
    });
  });

  describe('listDeliveriesQuerySchema', () => {
    it('uses defaults', () => {
      const result = listDeliveriesQuerySchema.parse({});
      expect(result.sortBy).toBe('createdAt');
      expect(result.sortOrder).toBe('desc');
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('accepts valid filters', () => {
      const result = listDeliveriesQuerySchema.parse({
        status: 'DELIVERED',
        carrier: 'GIG',
        sortBy: 'fee',
        sortOrder: 'asc',
      });
      expect(result.status).toBe('DELIVERED');
      expect(result.sortBy).toBe('fee');
    });

    it('rejects invalid status', () => {
      expect(() => listDeliveriesQuerySchema.parse({ status: 'PENDING' })).toThrow();
    });

    it('rejects invalid sortBy', () => {
      expect(() => listDeliveriesQuerySchema.parse({ sortBy: 'email' })).toThrow();
    });
  });

  describe('calculateCostSchema', () => {
    it('accepts valid cost calculation', () => {
      const result = calculateCostSchema.parse({
        pickupAddress: '123 Lagos Street',
        dropoffAddress: '456 Abuja Road',
      });
      expect(result.pickupAddress).toBe('123 Lagos Street');
    });

    it('accepts optional weight and dimensions', () => {
      const result = calculateCostSchema.parse({
        pickupAddress: 'Lagos',
        dropoffAddress: 'Abuja',
        weight: 5,
        length: 30,
        width: 20,
        height: 15,
        carrier: 'KWIK',
        insuranceAmount: 2000,
      });
      expect(result.weight).toBe(5);
      expect(result.carrier).toBe('KWIK');
    });
  });

  describe('cancelDeliverySchema', () => {
    it('accepts empty body', () => {
      expect(cancelDeliverySchema.parse({})).toEqual({});
    });

    it('accepts reason', () => {
      const result = cancelDeliverySchema.parse({ reason: 'Customer cancelled' });
      expect(result.reason).toBe('Customer cancelled');
    });
  });

  describe('rateDeliverySchema', () => {
    it('accepts valid rating', () => {
      const result = rateDeliverySchema.parse({ rating: 4, comment: 'Good delivery' });
      expect(result.rating).toBe(4);
    });

    it('accepts rating without comment', () => {
      expect(rateDeliverySchema.parse({ rating: 5 })).toEqual({ rating: 5 });
    });

    it('rejects rating < 1', () => {
      expect(() => rateDeliverySchema.parse({ rating: 0 })).toThrow();
    });

    it('rejects rating > 5', () => {
      expect(() => rateDeliverySchema.parse({ rating: 6 })).toThrow();
    });
  });
});
