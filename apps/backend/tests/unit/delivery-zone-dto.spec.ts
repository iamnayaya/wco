import {
  deliveryZoneIdParams,
  createDeliveryZoneSchema,
  updateDeliveryZoneSchema,
  listDeliveryZonesQuerySchema,
  checkAddressInZoneSchema,
} from '../../src/modules/deliveries/delivery-zone.dto.js';

describe('Delivery Zone DTOs', () => {
  describe('deliveryZoneIdParams', () => {
    it('accepts valid id', () => {
      expect(deliveryZoneIdParams.parse({ id: 'dz_123' })).toEqual({ id: 'dz_123' });
    });
    it('rejects empty id', () => {
      expect(() => deliveryZoneIdParams.parse({ id: '' })).toThrow();
    });
  });

  describe('createDeliveryZoneSchema', () => {
    it('accepts valid radius zone', () => {
      const result = createDeliveryZoneSchema.parse({
        name: 'Lagos Mainland',
        type: 'RADIUS',
        coordinates: [[3.39, 6.45], [3.42, 6.45], [3.42, 6.5], [3.39, 6.5], [3.39, 6.45]],
        centerLat: 6.45,
        centerLng: 3.40,
        radiusKm: 15,
        fee: 500,
        etaMinutes: 30,
      });
      expect(result.type).toBe('RADIUS');
      expect(result.fee).toBe(500);
      expect(result.coordinates).toHaveLength(5);
    });

    it('accepts valid polygon zone', () => {
      const result = createDeliveryZoneSchema.parse({
        name: 'VI Delivery Zone',
        type: 'CUSTOM',
        coordinates: [[3.40, 6.42], [3.45, 6.42], [3.45, 6.46], [3.40, 6.46], [3.40, 6.42]],
        fee: 750,
      });
      expect(result.type).toBe('CUSTOM');
    });

    it('rejects missing name', () => {
      expect(() => createDeliveryZoneSchema.parse({
        type: 'CUSTOM',
        coordinates: [[3.40, 6.42]],
        fee: 500,
      })).toThrow();
    });

    it('rejects empty coordinates', () => {
      expect(() => createDeliveryZoneSchema.parse({
        name: 'Test',
        type: 'CUSTOM',
        coordinates: [],
        fee: 500,
      })).toThrow();
    });

    it('rejects negative fee', () => {
      expect(() => createDeliveryZoneSchema.parse({
        name: 'Test',
        type: 'CUSTOM',
        coordinates: [[3.40, 6.42]],
        fee: -100,
      })).toThrow();
    });
  });

  describe('updateDeliveryZoneSchema', () => {
    it('accepts partial update', () => {
      const result = updateDeliveryZoneSchema.parse({ name: 'Updated Zone' });
      expect(result.name).toBe('Updated Zone');
    });

    it('accepts empty update', () => {
      expect(updateDeliveryZoneSchema.parse({})).toEqual({});
    });
  });

  describe('listDeliveryZonesQuerySchema', () => {
    it('uses defaults', () => {
      const result = listDeliveryZonesQuerySchema.parse({});
      expect(result).toEqual({ page: 1, pageSize: 20 });
    });

    it('accepts isActive filter', () => {
      const result = listDeliveryZonesQuerySchema.parse({ isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('coerces string "1" to true', () => {
      const result = listDeliveryZonesQuerySchema.parse({ isActive: '1' });
      expect(result.isActive).toBe(true);
    });
  });

  describe('checkAddressInZoneSchema', () => {
    it('accepts valid coordinates', () => {
      const result = checkAddressInZoneSchema.parse({ latitude: 6.45, longitude: 3.40 });
      expect(result.latitude).toBe(6.45);
      expect(result.longitude).toBe(3.40);
    });

    it('accepts with optional address', () => {
      const result = checkAddressInZoneSchema.parse({
        latitude: 6.45,
        longitude: 3.40,
        address: '123 Broad Street, Lagos',
      });
      expect(result.address).toBe('123 Broad Street, Lagos');
    });

    it('rejects out-of-range latitude', () => {
      expect(() => checkAddressInZoneSchema.parse({ latitude: 100, longitude: 3 })).toThrow();
    });

    it('rejects out-of-range longitude', () => {
      expect(() => checkAddressInZoneSchema.parse({ latitude: 6, longitude: 200 })).toThrow();
    });
  });
});
