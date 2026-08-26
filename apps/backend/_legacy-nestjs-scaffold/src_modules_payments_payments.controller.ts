import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('providers')
  @RequirePermissions('payments:read')
  @ApiOperation({ summary: 'Payment providers configured for this platform' })
  async providers() {
    return this.payments.listConfigured();
  }

  @Get()
  @RequirePermissions('payments:read')
  @ApiOperation({ summary: 'List payments (cursor-paginated)' })
  async list(@Query('cursor') cursor?: string, @Query('limit') limit = '25') {
    return this.payments.list({ cursor, limit: Number(limit) });
  }

  @Post('orders/:orderId/link')
  @RequirePermissions('payments:create')
  @ApiOperation({
    summary: 'Create a payment link for an order',
    description: 'Returns checkout_url to share over WhatsApp. Idempotent by PSP reference.',
  })
  async createLink(@Param('orderId') orderId: string) {
    return this.payments.createLink(orderId);
  }

  @Post(':reference/verify')
  @RequirePermissions('payments:update')
  @ApiOperation({ summary: 'Manually verify payment status with the PSP' })
  async verify(@Param('reference') reference: string) {
    return this.payments.verify(reference);
  }

  @Post('orders/:orderId/refund')
  @RequirePermissions('payments:refund')
  @ApiOperation({ summary: 'Refund a successful payment' })
  async refund(@Param('orderId') orderId: string) {
    return this.payments.refund(orderId);
  }
}
