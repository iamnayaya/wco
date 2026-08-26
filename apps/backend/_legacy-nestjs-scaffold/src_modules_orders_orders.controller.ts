import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller({ path: 'orders', version: '1' })
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('orders:create')
  @UseInterceptors(IdempotencyInterceptor) // X-Idempotency-Key header honored
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Prices computed server-side. Stock validated atomically. ' +
      'Safe to retry with same Idempotency key.',
  })
  async create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Get()
  @RequirePermissions('orders:read')
  @ApiOperation({ summary: 'List orders (cursor-paginated)' })
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '25',
    @Query('status') status?: string,
  ) {
    return this.orders.findByStore({
      cursor,
      limit: Math.min(Number(limit), 100),
      status,
    });
  }

  @Post(':id/confirm-payment')
  @RequirePermissions('payments:update')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Confirm payment for an order (idempotent)' })
  async confirmPayment(
    @Param('id') orderId: string,
    @Body('paymentReference') paymentReference: string,
  ) {
    await this.orders.confirmPayment(orderId, paymentReference);
    return { ok: true };
  }

  @Patch(':id/status')
  @RequirePermissions('orders:update')
  @ApiOperation({ summary: 'Transition order status (state-machine validated)' })
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.orders.updateStatus(id, body.status);
  }
}