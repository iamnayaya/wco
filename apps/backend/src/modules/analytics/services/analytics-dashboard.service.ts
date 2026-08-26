import type { AnalyticsDashboard, AnalyticsDashboardWidget } from '@prisma/client';
import { NotFoundError, ConflictError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * AnalyticsDashboardService — customizable merchant dashboards with widgets.
 */
export class AnalyticsDashboardService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async create(
    storeId: string,
    data: {
      name: string;
      description?: string;
      isDefault?: boolean;
      layout?: Record<string, unknown>;
      widgets?: Array<{
        widgetType: string;
        title: string;
        config?: Record<string, unknown>;
        position?: Record<string, unknown>;
        refreshSecs?: number;
      }>;
    },
  ): Promise<AnalyticsDashboard & { widgets: AnalyticsDashboardWidget[] }> {
    if (data.isDefault) {
      // Unset any existing default
      await this.db.analyticsDashboard.updateMany({
        where: { storeId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.db.analyticsDashboard.create({
      data: {
        storeId,
        name: data.name,
        description: data.description,
        isDefault: data.isDefault ?? false,
        layout: (data.layout ?? {}) as never,
        widgets: data.widgets
          ? { create: data.widgets.map((w) => ({
              storeId,
              widgetType: w.widgetType,
              title: w.title,
              config: (w.config ?? {}) as never,
              position: (w.position ?? {}) as never,
              refreshSecs: w.refreshSecs ?? 300,
            }))}
          : undefined,
      },
      include: { widgets: true },
    });
  }

  async getById(storeId: string, id: string): Promise<AnalyticsDashboard & { widgets: AnalyticsDashboardWidget[] }> {
    const dashboard = await this.db.analyticsDashboard.findFirst({
      where: { id, storeId },
      include: { widgets: { orderBy: { createdAt: 'asc' } } },
    });
    if (!dashboard) throw new NotFoundError('Analytics dashboard');
    return dashboard;
  }

  async getDefault(storeId: string): Promise<AnalyticsDashboard & { widgets: AnalyticsDashboardWidget[] } | null> {
    return this.db.analyticsDashboard.findFirst({
      where: { storeId, isDefault: true },
      include: { widgets: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async list(storeId: string): Promise<AnalyticsDashboard[]> {
    return this.db.analyticsDashboard.findMany({
      where: { storeId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async update(
    storeId: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      isDefault?: boolean;
      layout?: Record<string, unknown>;
    },
  ): Promise<AnalyticsDashboard> {
    const dashboard = await this.getById(storeId, id);

    if (data.isDefault && !dashboard.isDefault) {
      await this.db.analyticsDashboard.updateMany({
        where: { storeId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.db.analyticsDashboard.update({
      where: { id },
      data: {
        ...data,
        layout: data.layout ? (data.layout as never) : undefined,
      },
    });
  }

  async remove(storeId: string, id: string): Promise<void> {
    const dashboard = await this.getById(storeId, id);
    if (dashboard.isDefault) throw new ConflictError('Cannot delete the default dashboard');
    await this.db.analyticsDashboard.delete({ where: { id } });
  }

  async addWidget(
    storeId: string,
    dashboardId: string,
    data: {
      widgetType: string;
      title: string;
      config?: Record<string, unknown>;
      position?: Record<string, unknown>;
      refreshSecs?: number;
    },
  ): Promise<AnalyticsDashboardWidget> {
    await this.getById(storeId, dashboardId); // ownership check
    return this.db.analyticsDashboardWidget.create({
      data: {
        dashboardId,
        storeId,
        widgetType: data.widgetType,
        title: data.title,
        config: (data.config ?? {}) as never,
        position: (data.position ?? {}) as never,
        refreshSecs: data.refreshSecs ?? 300,
      },
    });
  }

  async updateWidget(
    storeId: string,
    dashboardId: string,
    widgetId: string,
    data: {
      title?: string;
      config?: Record<string, unknown>;
      position?: Record<string, unknown>;
      refreshSecs?: number;
    },
  ): Promise<AnalyticsDashboardWidget> {
    await this.getById(storeId, dashboardId); // ownership check
    const widget = await this.db.analyticsDashboardWidget.findFirst({
      where: { id: widgetId, dashboardId },
    });
    if (!widget) throw new NotFoundError('Dashboard widget');
    return this.db.analyticsDashboardWidget.update({
      where: { id: widgetId },
      data: {
        ...data,
        config: data.config ? (data.config as never) : undefined,
        position: data.position ? (data.position as never) : undefined,
      },
    });
  }

  async removeWidget(storeId: string, dashboardId: string, widgetId: string): Promise<void> {
    await this.getById(storeId, dashboardId); // ownership check
    const widget = await this.db.analyticsDashboardWidget.findFirst({
      where: { id: widgetId, dashboardId },
    });
    if (!widget) throw new NotFoundError('Dashboard widget');
    await this.db.analyticsDashboardWidget.delete({ where: { id: widgetId } });
  }

  async getWidgets(storeId: string, dashboardId: string): Promise<AnalyticsDashboardWidget[]> {
    await this.getById(storeId, dashboardId); // ownership check
    return this.db.analyticsDashboardWidget.findMany({
      where: { dashboardId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const analyticsDashboardService = new AnalyticsDashboardService();
