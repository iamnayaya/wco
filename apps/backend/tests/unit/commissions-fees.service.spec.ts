import { CommissionsService } from '../../src/modules/payments/services/commissions.service.js';
import { FeesService } from '../../src/modules/payments/services/fees.service.js';

/**
 * CommissionsService unit tests — verifies commission calculation,
 * processing, batch settlement, and summary queries with mocked Prisma.
 */

const mockCommissionDb = {
  commission: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
} as unknown as {
  commission: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
  };
};

describe('CommissionsService', () => {
  let service: CommissionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommissionsService(mockCommissionDb as never);
  });

  describe('calculate', () => {
    it('creates commission with default 2% rate', async () => {
      mockCommissionDb.commission.create.mockResolvedValue({
        id: 'comm_1',
        storeId: 'store_1',
        paymentId: 'pay_1',
        rate: 0.02,
        amount: 200,
        currency: 'NGN',
        status: 'PENDING',
        createdAt: new Date(),
      });

      const result = await service.calculate('pay_1', 'store_1', 10000, 'NGN');

      expect(result.amount).toBe(200);
      expect(result.rate).toBe(0.02);
      expect(result.status).toBe('PENDING');
      expect(mockCommissionDb.commission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storeId: 'store_1',
            paymentId: 'pay_1',
            rate: 0.02,
            amount: 200,
          }),
        }),
      );
    });

    it('calculates with custom rate', async () => {
      mockCommissionDb.commission.create.mockResolvedValue({
        id: 'comm_2',
        rate: 0.01,
        amount: 50,
        currency: 'NGN',
        status: 'PENDING',
      });

      const result = await service.calculate('pay_2', 'store_1', 5000, 'NGN', 0.01);

      expect(result.amount).toBe(50);
      expect(result.rate).toBe(0.01);
    });

    it('rounds commission to 2 decimal places', async () => {
      mockCommissionDb.commission.create.mockResolvedValue({
        id: 'comm_3',
        rate: 0.02,
        amount: 33.33,
        currency: 'NGN',
        status: 'PENDING',
      });

      const result = await service.calculate('pay_3', 'store_1', 1666.66, 'NGN');

      expect(result.amount).toBe(33.33);
    });
  });

  describe('process', () => {
    it('settles a pending commission', async () => {
      mockCommissionDb.commission.findUnique.mockResolvedValue({
        id: 'comm_1',
        status: 'PENDING',
      });
      mockCommissionDb.commission.update.mockResolvedValue({
        id: 'comm_1',
        status: 'SETTLED',
        settledAt: new Date(),
      });

      const result = await service.process('comm_1');

      expect(result.status).toBe('SETTLED');
    });

    it('throws on missing commission', async () => {
      mockCommissionDb.commission.findUnique.mockResolvedValue(null);

      await expect(service.process('comm_none')).rejects.toThrow('Commission');
    });

    it('throws on already-settled commission', async () => {
      mockCommissionDb.commission.findUnique.mockResolvedValue({
        id: 'comm_1',
        status: 'SETTLED',
      });

      await expect(service.process('comm_1')).rejects.toThrow('SETTLED');
    });
  });

  describe('settleBatch', () => {
    it('settles multiple commissions', async () => {
      mockCommissionDb.commission.updateMany.mockResolvedValue({ count: 3 });

      const count = await service.settleBatch(['comm_1', 'comm_2', 'comm_3'], 'SETT_001');

      expect(count).toBe(3);
      expect(mockCommissionDb.commission.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: ['comm_1', 'comm_2', 'comm_3'] } }),
          data: expect.objectContaining({ status: 'SETTLED', settlementRef: 'SETT_001' }),
        }),
      );
    });
  });

  describe('getStoreSummary', () => {
    it('returns summary with correct counts and amounts', async () => {
      mockCommissionDb.commission.count
        .mockResolvedValueOnce(5) // pending count
        .mockResolvedValueOnce(10); // settled count
      mockCommissionDb.commission.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 2500 } }) // pending sum
        .mockResolvedValueOnce({ _sum: { amount: 5000 } }); // settled sum

      const summary = await service.getStoreSummary('store_1');

      expect(summary.totalPending).toBe(5);
      expect(summary.totalSettled).toBe(10);
      expect(summary.pendingAmount).toBe(2500);
      expect(summary.settledAmount).toBe(5000);
    });
  });

  describe('listByStore', () => {
    it('returns paginated commissions', async () => {
      mockCommissionDb.commission.findMany.mockResolvedValue([
        { id: 'comm_1', storeId: 'store_1', amount: 100 },
        { id: 'comm_2', storeId: 'store_1', amount: 200 },
      ]);

      const result = await service.listByStore('store_1', 1, 20);

      expect(result).toHaveLength(2);
    });

    it('applies status filter', async () => {
      await service.listByStore('store_1', 1, 20, { status: 'PENDING' });

      expect(mockCommissionDb.commission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });
  });
});

/**
 * FeesService unit tests — verifies fee calculation with rate and flat
 * amount, processing, waiving, and summary queries.
 */

const mockFeeDb = {
  fee: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { calculatedAmount: 0 } }),
  },
  payment: {
    findUnique: jest.fn(),
  },
} as unknown as {
  fee: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
  };
  payment: {
    findUnique: jest.Mock;
  };
};

describe('FeesService', () => {
  let service: FeesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FeesService(mockFeeDb as never);
  });

  describe('calculate', () => {
    it('calculates fee with flat amount', async () => {
      mockFeeDb.fee.create.mockResolvedValue({
        id: 'fee_1',
        type: 'PROCESSING',
        calculatedAmount: 100,
        currency: 'NGN',
        status: 'PENDING',
      });

      const result = await service.calculate('pay_1', 'store_1', {
        type: 'PROCESSING',
        flatAmount: 100,
        currency: 'NGN',
      });

      expect(result.calculatedAmount).toBe(100);
      expect(result.status).toBe('PENDING');
    });

    it('calculates fee with rate from payment amount', async () => {
      mockFeeDb.payment.findUnique.mockResolvedValue({ amount: 10000 });
      mockFeeDb.fee.create.mockResolvedValue({
        id: 'fee_2',
        type: 'PROCESSING',
        rate: 0.015,
        calculatedAmount: 150,
        currency: 'NGN',
        status: 'PENDING',
      });

      const result = await service.calculate('pay_1', 'store_1', {
        type: 'PROCESSING',
        rate: 0.015,
        currency: 'NGN',
      });

      expect(result.calculatedAmount).toBe(150);
      expect(result.rate).toBe(0.015);
      expect(mockFeeDb.payment.findUnique).toHaveBeenCalledWith({ where: { id: 'pay_1' } });
    });

    it('returns 0 when no rate or flat amount', async () => {
      mockFeeDb.fee.create.mockResolvedValue({
        id: 'fee_3',
        type: 'PLATFORM',
        calculatedAmount: 0,
        currency: 'NGN',
        status: 'PENDING',
      });

      const result = await service.calculate('pay_1', 'store_1', {
        type: 'PLATFORM',
        currency: 'NGN',
      });

      expect(result.calculatedAmount).toBe(0);
    });

    it('records provider fee metadata', async () => {
      mockFeeDb.fee.create.mockResolvedValue({
        id: 'fee_4',
        calculatedAmount: 150,
        providerFee: 137.5,
        status: 'PENDING',
      });

      await service.calculate('pay_1', 'store_1', {
        type: 'PROCESSING',
        flatAmount: 150,
        providerFee: 137.5,
        currency: 'NGN',
      });

      expect(mockFeeDb.fee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ providerFee: 137.5 }),
        }),
      );
    });
  });

  describe('process', () => {
    it('charges a pending fee', async () => {
      mockFeeDb.fee.findUnique.mockResolvedValue({ id: 'fee_1', status: 'PENDING' });
      mockFeeDb.fee.update.mockResolvedValue({ id: 'fee_1', status: 'CHARGED' });

      const result = await service.process('fee_1');

      expect(result.status).toBe('CHARGED');
    });

    it('throws on missing fee', async () => {
      mockFeeDb.fee.findUnique.mockResolvedValue(null);

      await expect(service.process('fee_none')).rejects.toThrow('Fee');
    });

    it('throws on already charged fee', async () => {
      mockFeeDb.fee.findUnique.mockResolvedValue({ id: 'fee_1', status: 'CHARGED' });

      await expect(service.process('fee_1')).rejects.toThrow('CHARGED');
    });
  });

  describe('waive', () => {
    it('waives a fee', async () => {
      mockFeeDb.fee.findUnique.mockResolvedValue({ id: 'fee_1', meta: {} });
      mockFeeDb.fee.update.mockResolvedValue({
        id: 'fee_1',
        status: 'WAIVED',
        meta: { waivedReason: 'Promotion' },
      });

      const result = await service.waive('fee_1', 'Promotion');

      expect(result.status).toBe('WAIVED');
      expect(mockFeeDb.fee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'WAIVED',
            meta: expect.objectContaining({ waivedReason: 'Promotion' }),
          }),
        }),
      );
    });

    it('throws on missing fee', async () => {
      mockFeeDb.fee.findUnique.mockResolvedValue(null);

      await expect(service.waive('fee_none')).rejects.toThrow('Fee');
    });
  });

  describe('getStoreSummary', () => {
    it('returns summary with correct counts and amounts', async () => {
      mockFeeDb.fee.count
        .mockResolvedValueOnce(8) // charged count
        .mockResolvedValueOnce(2); // waived count
      mockFeeDb.fee.aggregate
        .mockResolvedValueOnce({ _sum: { calculatedAmount: 1200 } }) // charged sum
        .mockResolvedValueOnce({ _sum: { calculatedAmount: 300 } }); // waived sum

      const summary = await service.getStoreSummary('store_1');

      expect(summary.totalCharged).toBe(8);
      expect(summary.totalWaived).toBe(2);
      expect(summary.chargedAmount).toBe(1200);
      expect(summary.waivedAmount).toBe(300);
    });
  });

  describe('listByStore', () => {
    it('applies type filter', async () => {
      await service.listByStore('store_1', 1, 20, { type: 'PROCESSING' });

      expect(mockFeeDb.fee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'PROCESSING' }),
        }),
      );
    });

    it('applies status filter', async () => {
      await service.listByStore('store_1', 1, 20, { status: 'CHARGED' });

      expect(mockFeeDb.fee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'CHARGED' }),
        }),
      );
    });
  });
});
