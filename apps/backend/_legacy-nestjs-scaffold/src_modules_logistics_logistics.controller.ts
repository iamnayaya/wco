import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { LogisticsService } from './logistics.service';

export class BookShipmentDto {
  @ApiProperty({ enum: ['GIG', 'KWIK', 'SENDY'] })
  @IsIn(['GIG', 'KWIK', 'SENDY'])
  carrier!: string;

  @ApiPropertyOptional({ description: 'Quote id returned by /quotes (TTL ~15 min)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  quoteId?: string;
}

@ApiTags('logistics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'logistics', version: '1' })
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Get('orders/:orderId/quotes')
  @RequirePermissions('logistics:read')
  @ApiOperation({
    summary: 'Get delivery quotes for an order',
    description: 'Parallel fan-out to all configured carriers. Sorted by price ascending.',
  })
  async quotes(@Param('orderId') orderId: string) {
    return this.logistics.quoteOrder(orderId);
  }

  @Post('orders/:orderId/book')
  @RequirePermissions('logistics:create')
  @ApiOperation({ summary: 'Book a shipment with the chosen carrier' })
  async book(@Param('orderId') orderId: string, @Body() dto: BookShipmentDto) {
    return this.logistics.book(orderId, dto.carrier, dto.quoteId);
  }

  @Get('shipments')
  @RequirePermissions('logistics:read')
  @ApiOperation({ summary: 'List recent deliveries for the active store' })
  async list() {
    return { items: await this.logistics.listDeliveries() };
  }

  @Get('shipments/:shipmentId/track')
  @RequirePermissions('logistics:read')
  @ApiOperation({ summary: 'Live tracking status for a delivery' })
  async track(@Param('shipmentId') shipmentId: string) {
    return this.logistics.track(shipmentId);
  }
}
