import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @RequirePermissions('analytics:read')
  @ApiOperation({
    summary: 'Dashboard summary: today vs yesterday + 7-day timeseries',
    description: 'Served from 60s Redis cache over daily rollups — safe to poll.',
  })
  async summary() {
    return this.analytics.summary();
  }

  @Get('top-products')
  @RequirePermissions('analytics:read')
  @ApiOperation({ summary: 'Best sellers by revenue over a window' })
  async topProducts(@Query('days') days = '30') {
    return this.analytics.topProducts(Math.min(Number(days), 365));
  }

  @Get('funnel')
  @RequirePermissions('analytics:read')
  @ApiOperation({ summary: 'Conversation → order → paid conversion funnel' })
  async funnel(@Query('days') days = '30') {
    return this.analytics.conversionFunnel(Math.min(Number(days), 365));
  }
}
