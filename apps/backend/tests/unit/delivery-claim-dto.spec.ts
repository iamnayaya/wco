import {
  deliveryClaimIdParams,
  createDeliveryClaimSchema,
  updateDeliveryClaimSchema,
  processClaimSchema,
  listClaimsQuerySchema,
} from '../../src/modules/deliveries/delivery-claim.dto.js';

describe('Delivery Claim DTOs', () => {
  describe('deliveryClaimIdParams', () => {
    it('accepts valid ids', () => {
      const result = deliveryClaimIdParams.parse({ id: 'del_1', claimId: 'clm_2' });
      expect(result).toEqual({ id: 'del_1', claimId: 'clm_2' });
    });

    it('rejects missing claimId', () => {
      expect(() => deliveryClaimIdParams.parse({ id: 'del_1' })).toThrow();
    });
  });

  describe('createDeliveryClaimSchema', () => {
    it('accepts valid claim', () => {
      const result = createDeliveryClaimSchema.parse({ type: 'LOST' });
      expect(result.type).toBe('LOST');
      expect(result.evidenceUrls).toEqual([]);
    });

    it('accepts all fields', () => {
      const result = createDeliveryClaimSchema.parse({
        type: 'DAMAGED',
        description: 'Package arrived wet and damaged',
        evidenceUrls: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      });
      expect(result.type).toBe('DAMAGED');
      expect(result.evidenceUrls).toHaveLength(2);
    });

    it('rejects invalid type', () => {
      expect(() => createDeliveryClaimSchema.parse({ type: 'STOLEN' })).toThrow();
    });

    it('rejects too many evidence URLs', () => {
      expect(() => createDeliveryClaimSchema.parse({
        type: 'OTHER',
        evidenceUrls: Array(11).fill('https://example.com/img.jpg'),
      })).toThrow();
    });
  });

  describe('updateDeliveryClaimSchema', () => {
    it('accepts partial update', () => {
      const result = updateDeliveryClaimSchema.parse({ description: 'Updated description' });
      expect(result.description).toBe('Updated description');
    });

    it('accepts empty update', () => {
      expect(updateDeliveryClaimSchema.parse({})).toEqual({});
    });
  });

  describe('processClaimSchema', () => {
    it('accepts approval', () => {
      const result = processClaimSchema.parse({
        status: 'APPROVED',
        resolution: 'Full refund issued',
        payoutAmount: 15000,
      });
      expect(result.status).toBe('APPROVED');
      expect(result.payoutAmount).toBe(15000);
    });

    it('accepts rejection', () => {
      const result = processClaimSchema.parse({
        status: 'REJECTED',
        resolution: 'Insufficient evidence',
      });
      expect(result.status).toBe('REJECTED');
    });

    it('rejects invalid status', () => {
      expect(() => processClaimSchema.parse({ status: 'PENDING' })).toThrow();
    });
  });

  describe('listClaimsQuerySchema', () => {
    it('uses defaults', () => {
      const result = listClaimsQuerySchema.parse({});
      expect(result).toEqual({ page: 1, pageSize: 20 });
    });

    it('accepts status filter', () => {
      const result = listClaimsQuerySchema.parse({ status: 'APPROVED' });
      expect(result.status).toBe('APPROVED');
    });

    it('rejects invalid status', () => {
      expect(() => listClaimsQuerySchema.parse({ status: 'SETTLED' })).toThrow();
    });
  });
});
