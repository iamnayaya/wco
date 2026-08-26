import { AnalyticsDashboardService } from '../../src/modules/analytics/services/analytics-dashboard.service.js';

function createMockDb() {
  return {
    analyticsDashboard: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    analyticsDashboardWidget: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('AnalyticsDashboardService', () => {
  let service: AnalyticsDashboardService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    service = new AnalyticsDashboardService(mockDb as never);
  });

  describe('create', () => {
    it('creates a dashboard', async () => {
      const dashboard = {
        id: 'dash_1',
        storeId: 'store_1',
        name: 'Sales Dashboard',
        isDefault: false,
        widgets: [],
      };
      mockDb.analyticsDashboard.create.mockResolvedValue(dashboard);

      const result = await service.create('store_1', { name: 'Sales Dashboard' });
      expect(result.name).toBe('Sales Dashboard');
      expect(mockDb.analyticsDashboard.create).toHaveBeenCalled();
    });

    it('sets as default and unsets others', async () => {
      mockDb.analyticsDashboard.updateMany.mockResolvedValue({ count: 1 });
      const dashboard = { id: 'dash_1', storeId: 'store_1', name: 'Default', isDefault: true, widgets: [] };
      mockDb.analyticsDashboard.create.mockResolvedValue(dashboard);

      await service.create('store_1', { name: 'Default', isDefault: true });
      expect(mockDb.analyticsDashboard.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isDefault: false } }),
      );
    });

    it('creates with widgets', async () => {
      const dashboard = { id: 'dash_1', name: 'X', widgets: [] };
      mockDb.analyticsDashboard.create.mockResolvedValue(dashboard);

      await service.create('store_1', {
        name: 'With Widgets',
        widgets: [
          { widgetType: 'kpi_card', title: 'Revenue' },
          { widgetType: 'line_chart', title: 'Sales Trend' },
        ],
      });

      expect(mockDb.analyticsDashboard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            widgets: expect.objectContaining({ create: expect.arrayContaining([expect.any(Object)]) }),
          }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('returns dashboard with widgets', async () => {
      mockDb.analyticsDashboard.findFirst.mockResolvedValue({
        id: 'dash_1',
        storeId: 'store_1',
        widgets: [{ id: 'w_1', title: 'Revenue' }],
      });
      const result = await service.getById('store_1', 'dash_1');
      expect(result.widgets).toHaveLength(1);
    });

    it('throws when not found', async () => {
      mockDb.analyticsDashboard.findFirst.mockResolvedValue(null);
      await expect(service.getById('store_1', 'missing')).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('returns dashboards for store', async () => {
      mockDb.analyticsDashboard.findMany.mockResolvedValue([
        { id: 'dash_1', name: 'Default', isDefault: true },
        { id: 'dash_2', name: 'Custom', isDefault: false },
      ]);
      const result = await service.list('store_1');
      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('updates dashboard name', async () => {
      mockDb.analyticsDashboard.findFirst.mockResolvedValue({
        id: 'dash_1',
        storeId: 'store_1',
        isDefault: false,
      });
      mockDb.analyticsDashboard.update.mockResolvedValue({
        id: 'dash_1',
        name: 'Updated',
      });
      const result = await service.update('store_1', 'dash_1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('deletes non-default dashboard', async () => {
      mockDb.analyticsDashboard.findFirst.mockResolvedValue({
        id: 'dash_1',
        storeId: 'store_1',
        isDefault: false,
      });
      mockDb.analyticsDashboard.delete.mockResolvedValue({});
      await service.remove('store_1', 'dash_1');
      expect(mockDb.analyticsDashboard.delete).toHaveBeenCalledWith({ where: { id: 'dash_1' } });
    });

    it('throws when trying to delete default', async () => {
      mockDb.analyticsDashboard.findFirst.mockResolvedValue({
        id: 'dash_1',
        isDefault: true,
      });
      await expect(service.remove('store_1', 'dash_1')).rejects.toThrow();
    });
  });

  describe('addWidget', () => {
    it('creates a widget on a dashboard', async () => {
      mockDb.analyticsDashboard.findFirst.mockResolvedValue({ id: 'dash_1', storeId: 'store_1' });
      mockDb.analyticsDashboardWidget.create.mockResolvedValue({
        id: 'w_1',
        widgetType: 'kpi_card',
        title: 'Revenue',
      });

      const result = await service.addWidget('store_1', 'dash_1', {
        widgetType: 'kpi_card',
        title: 'Revenue',
      });
      expect(result.widgetType).toBe('kpi_card');
    });

    it('throws when dashboard not found', async () => {
      mockDb.analyticsDashboard.findFirst.mockResolvedValue(null);
      await expect(service.addWidget('store_1', 'missing', {
        widgetType: 'kpi',
        title: 'X',
      })).rejects.toThrow();
    });
  });

  describe('getWidgets', () => {
    it('returns widgets for a dashboard', async () => {
      mockDb.analyticsDashboard.findFirst.mockResolvedValue({ id: 'dash_1' });
      mockDb.analyticsDashboardWidget.findMany.mockResolvedValue([
        { id: 'w_1', title: 'Revenue' },
        { id: 'w_2', title: 'Orders' },
      ]);
      const result = await service.getWidgets('store_1', 'dash_1');
      expect(result).toHaveLength(2);
    });
  });
});
