import {
  createDeliveryAddressSchema,
  updateDeliveryAddressSchema,
  deliveryAddressIdParams,
  listDeliveryAddressesQuerySchema,
  validateAddressSchema,
  geocodeAddressSchema,
  reverseGeocodeSchema,
} from '../../src/modules/deliveries/delivery-address.dto.js';

describe('Delivery Address DTOs', () => {
  describe('deliveryAddressIdParams', () => {
    it('accepts valid id', () => {
      expect(deliveryAddressIdParams.parse({ id: 'da_123' })).toEqual({ id: 'da_123' });
    });
    it('rejects empty id', () => {
      expect(() => deliveryAddressIdParams.parse({ id: '' })).toThrow();
    });
  });

  describe('createDeliveryAddressSchema', () => {
    it('accepts valid address', () => {
      const result = createDeliveryAddressSchema.parse({
        label: 'Warehouse',
        addressLine1: '123 Broad Street',
        city: 'Lagos',
        country: 'NG',
      });
      expect(result.label).toBe('Warehouse');
      expect(result.country).toBe('NG');
      expect(result.isDefault).toBe(false);
    });

    it('accepts all optional fields', () => {
      const result = createDeliveryAddressSchema.parse({
        label: 'Customer HQ',
        contactName: 'John Doe',
        contactPhone: '+2348012345678',
        addressLine1: '123 Broad Street',
        addressLine2: 'Suite 5',
        city: 'Lagos',
        state: 'Lagos',
        country: 'NG',
        postalCode: '100001',
        latitude: 6.4541,
        longitude: 3.3947,
        isDefault: true,
        meta: { floor: 3 },
      });
      expect(result.isDefault).toBe(true);
      expect(result.latitude).toBe(6.4541);
    });

    it('rejects missing label', () => {
      expect(() => createDeliveryAddressSchema.parse({
        addressLine1: '123 Street',
        city: 'Lagos',
      })).toThrow();
    });

    it('rejects short address', () => {
      expect(() => createDeliveryAddressSchema.parse({
        label: 'Home',
        addressLine1: '123',
        city: 'Lagos',
      })).toThrow();
    });
  });

  describe('updateDeliveryAddressSchema', () => {
    it('accepts partial update', () => {
      const result = updateDeliveryAddressSchema.parse({ city: 'Abuja' });
      expect(result.city).toBe('Abuja');
    });

    it('accepts empty update', () => {
      expect(updateDeliveryAddressSchema.parse({})).toEqual({});
    });
  });

  describe('listDeliveryAddressesQuerySchema', () => {
    it('uses defaults', () => {
      const result = listDeliveryAddressesQuerySchema.parse({});
      expect(result).toEqual({ page: 1, pageSize: 20 });
    });

    it('accepts city filter', () => {
      const result = listDeliveryAddressesQuerySchema.parse({ city: 'Lagos' });
      expect(result.city).toBe('Lagos');
    });
  });

  describe('validateAddressSchema', () => {
    it('accepts valid address', () => {
      const result = validateAddressSchema.parse({
        addressLine1: '123 Broad Street, Lagos',
        city: 'Lagos',
      });
      expect(result.country).toBe('NG');
    });
  });

  describe('geocodeAddressSchema', () => {
    it('accepts valid address', () => {
      const result = geocodeAddressSchema.parse({
        address: '123 Broad Street, Lagos, Nigeria',
      });
      expect(result.address).toContain('Lagos');
    });

    it('rejects short address', () => {
      expect(() => geocodeAddressSchema.parse({ address: 'Lag' })).toThrow();
    });
  });

  describe('reverseGeocodeSchema', () => {
    it('accepts valid coordinates', () => {
      const result = reverseGeocodeSchema.parse({ latitude: 6.45, longitude: 3.39 });
      expect(result.latitude).toBe(6.45);
    });

    it('rejects invalid latitude', () => {
      expect(() => reverseGeocodeSchema.parse({ latitude: 100, longitude: 3 })).toThrow();
    });

    it('rejects invalid longitude', () => {
      expect(() => reverseGeocodeSchema.parse({ latitude: 6, longitude: 200 })).toThrow();
    });
  });
});
