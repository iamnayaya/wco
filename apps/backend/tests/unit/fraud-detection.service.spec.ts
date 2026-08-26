import { FraudDetectionService } from '../../src/modules/payments/services/fraud-detection.service.js';

/**
 * FraudDetectionService unit tests — verifies each heuristic in isolation
 * using a mocked Prisma client. No database required.
 */

const mockDb = {
  payment: {
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _avg: { amount: 0 } }),
    findMany: jest.fn().mockResolvedValue([]),
  },
} as unknown as {
  payment: {
    count: jest.Mock;
    aggregate: jest.Mock;
    findMany: jest.Mock;
  };
};

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FraudDetectionService(mockDb as never);
  });

  describe('analyze', () => {
    it('returns score 0 for a normal payment', async () => {
      mockDb.payment.count.mockResolvedValue(0);
      mockDb.payment.aggregate.mockResolvedValue({ _avg: { amount: 10000 } });

      const result = await service.analyze('store_1', {
        amount: 5000,
        currency: 'NGN',
        provider: 'PAYSTACK',
      });

      expect(result.score).toBe(0);
      expect(result.flagged).toBe(false);
      expect(result.blocked).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('flags high velocity (>= 5 payments in window)', async () => {
      // First call: velocity check (6 payments)
      mockDb.payment.count
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(0);

      const result = await service.analyze('store_1', {
        amount: 5000,
        currency: 'NGN',
        provider: 'PAYSTACK',
      });

      expect(result.score).toBe(20);
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringContaining('High payment velocity')]),
      );
    });

    it('flags very high velocity (>= 10 payments)', async () => {
      mockDb.payment.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(0);

      const result = await service.analyze('store_1', {
        amount: 5000,
        currency: 'NGN',
        provider: 'PAYSTACK',
      });

      expect(result.score).toBe(40);
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringContaining('High payment velocity')]),
      );
    });

    it('flags amount anomaly (>= 5x average)', async () => {
      mockDb.payment.count.mockResolvedValue(0);
      mockDb.payment.aggregate.mockResolvedValue({ _avg: { amount: 5000 } });

      const result = await service.analyze('store_1', {
        amount: 25000,
        currency: 'NGN',
        provider: 'PAYSTACK',
      });

      expect(result.score).toBe(40);
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringContaining('significantly above average')]),
      );
    });

    it('flags moderate amount anomaly (>= 2.5x average)', async () => {
      mockDb.payment.count.mockResolvedValue(0);
      mockDb.payment.aggregate.mockResolvedValue({ _avg: { amount: 5000 } });

      const result = await service.analyze('store_1', {
        amount: 12500,
        currency: 'NGN',
        provider: 'PAYSTACK',
      });

      expect(result.score).toBe(20);
    });

    it('flags repeat failures (>= 3)', async () => {
      // Call order: count(velocity), aggregate(amount), count(failures)
      mockDb.payment.count
        .mockResolvedValueOnce(0) // velocity
        .mockResolvedValueOnce(3); // failures
      mockDb.payment.aggregate.mockResolvedValue({ _avg: { amount: 5000 } });

      const result = await service.analyze('store_1', {
        amount: 5000,
        currency: 'NGN',
        provider: 'PAYSTACK',
      });

      expect(result.score).toBe(30);
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringContaining('3 recent failed payments')]),
      );
    });

    it('flags first-time high value payment', async () => {
      // Call order: count(velocity), aggregate(amount), count(failures), count(first-time)
      mockDb.payment.count
        .mockResolvedValueOnce(0) // velocity
        .mockResolvedValueOnce(0) // failures
        .mockResolvedValueOnce(0); // first-time: 0 previous succeeded
      mockDb.payment.aggregate.mockResolvedValue({ _avg: { amount: 5000 } });

      const result = await service.analyze('store_1', {
        amount: 600000,
        currency: 'NGN',
        provider: 'PAYSTACK',
      });

      // amount anomaly: 600000/5000 = 120x → 40; first-time: 25; total = 65
      expect(result.score).toBe(65);
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringContaining('High-value payment from new flow')]),
      );
    });

    it('does not flag first-time high value if there are previous payments', async () => {
      // Call order: count(velocity), aggregate(amount), count(failures), count(first-time)
      mockDb.payment.count
        .mockResolvedValueOnce(0) // velocity
        .mockResolvedValueOnce(0) // failures
        .mockResolvedValueOnce(5); // 5 previous succeeded payments
      mockDb.payment.aggregate.mockResolvedValue({ _avg: { amount: 0 } });

      const result = await service.analyze('store_1', {
        amount: 600000,
        currency: 'NGN',
        provider: 'PAYSTACK',
      });

      // avg=0 so amount anomaly fires (25); first-time is 0 (previousSucceeded > 0)
      expect(result.score).toBe(25);
    });

    it('caps score at 100', async () => {
      mockDb.payment.count
        .mockResolvedValueOnce(10) // velocity: 40
        .mockResolvedValueOnce(3) // failures: 30
        .mockResolvedValueOnce(0); // first-time: 25
      mockDb.payment.aggregate.mockResolvedValue({ _avg: { amount: 1000 } });

      const result = await service.analyze('store_1', {
        amount: 50000,
        currency: 'NGN',
        provider: 'PAYSTACK',
      });

      // 40 + 40 (50x avg) + 30 + 25 = 135 → capped to 100
      expect(result.score).toBe(100);
    });

    it('blocks when score >= 90', async () => {
      mockDb.payment.count = jest.fn()
        .mockResolvedValueOnce(10) // velocity: 40
        .mockResolvedValueOnce(3) // failures: 30
        .mockResolvedValueOnce(0); // first-time: no prev succeeded, but amount < 500000 so 0
      mockDb.payment.aggregate = jest.fn().mockResolvedValue({ _avg: { amount: 100 } });

      const result = await service.analyze('store_1', {
        amount: 500000,
        currency: 'NGN',
        provider: 'PAYSTACK',
      });

      // velocity: 40, amount anomaly: 500000/100=5000x→40, failures: 30, first-time: 25
      // total: 135 → capped to 100
      expect(result.score).toBe(100);
      expect(result.blocked).toBe(true);
    });
  });

  describe('getFlaggedPayments', () => {
    it('returns flagged payments with fraud score', async () => {
      mockDb.payment.findMany.mockResolvedValue([
        {
          id: 'pay_1',
          amount: 100000,
          provider: 'PAYSTACK',
          status: 'SUCCEEDED',
          createdAt: new Date(),
          meta: { fraudScore: 75 },
        },
      ]);

      const result = await service.getFlaggedPayments('store_1', 1, 20);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pay_1');
      expect(result[0].fraudScore).toBe(75);
    });

    it('returns empty array when no flagged payments', async () => {
      mockDb.payment.findMany.mockResolvedValue([]);

      const result = await service.getFlaggedPayments('store_1', 1, 20);

      expect(result).toHaveLength(0);
    });
  });
});
