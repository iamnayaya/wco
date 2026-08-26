import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@wco/database';

export interface NotificationPreferences {
  orderPaid: boolean;
  lowStockAlerts: boolean;
  dailySummary: boolean;
  weeklyReport: boolean;
  aiHandoffAlerts: boolean;
}

const DEFAULTS: NotificationPreferences = {
  orderPaid: true,
  lowStockAlerts: true,
  dailySummary: true,
  weeklyReport: false,
  aiHandoffAlerts: true,
};

/**
 * NotificationsService — per-user notification channel preferences.
 * Delivery itself happens in workers (WhatsApp/email/SMS); this is the
 * control plane the dashboard writes to.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    // userId comes from the verified JWT (`sub`) and is globally unique,
    // so id+active is a complete ownership check here.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true, settings: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const settings = (user.settings ?? {}) as Record<string, unknown>;
    return { ...DEFAULTS, ...(settings.notificationPreferences as object | undefined) };
  }

  async updatePreferences(userId: string, patch: Partial<NotificationPreferences>) {
    const current = await this.getPreferences(userId);
    const merged = { ...current, ...patch };

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        settings: { notificationPreferences: merged } as never,
      },
    });
    return merged;
  }
}
