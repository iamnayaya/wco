import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { NotificationsService, NotificationPreferences } from './notifications.service';

export class UpdateNotificationPrefsDto implements Partial<NotificationPreferences> {
  @IsOptional() @IsBoolean() orderPaid?: boolean;
  @IsOptional() @IsBoolean() lowStockAlerts?: boolean;
  @IsOptional() @IsBoolean() dailySummary?: boolean;
  @IsOptional() @IsBoolean() weeklyReport?: boolean;
  @IsOptional() @IsBoolean() aiHandoffAlerts?: boolean;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'My notification channel preferences' })
  async getPreferences(@Req() req: FastifyRequest) {
    return this.notifications.getPreferences((req.user as { sub: string }).sub);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preferences (partial update)' })
  async updatePreferences(
    @Body() dto: UpdateNotificationPrefsDto,
    @Req() req: FastifyRequest,
  ) {
    return this.notifications.updatePreferences((req.user as { sub: string }).sub, dto);
  }
}
