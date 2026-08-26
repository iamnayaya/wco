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
import { PricingService } from './pricing.service';

@ApiTags('pricing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'pricing', version: '1' })
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('suggestions')
  @RequirePermissions('pricing:read')
  @ApiOperation({ summary: 'AI price suggestions (default: pending only)' })
  async suggestions(@Query('status') status = 'PENDING') {
    return this.pricing.listSuggestions(status);
  }

  @Post('suggestions/:id/approve')
  @RequirePermissions('pricing:update')
  @ApiOperation({ summary: 'Approve suggestion — applies new price atomically' })
  async approve(@Param('id') id: string) {
    return this.pricing.approve(id);
  }

  @Post('suggestions/:id/dismiss')
  @RequirePermissions('pricing:update')
  @ApiOperation({ summary: 'Dismiss a suggestion' })
  async dismiss(@Param('id') id: string) {
    return this.pricing.dismiss(id);
  }

  @Post('optimize')
  @RequirePermissions('pricing:update')
  @ApiOperation({ summary: 'Queue an AI optimization run for this store' })
  async optimize() {
    return this.pricing.requestOptimization();
  }
}
