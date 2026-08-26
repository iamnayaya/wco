import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { WebhooksService } from './webhooks.service';

const EVENT_CHOICES = [
  'message.received', 'message.sent', 'conversation.escalated', 'conversation.resolved',
  'order.created', 'order.paid', 'order.shipped', 'order.delivered', 'order.cancelled',
  'payment.succeeded', 'payment.failed', 'payment.refunded',
  'cart.abandoned', 'customer.created', 'customer.returned',
  'ai.reply.generated', 'ai.handoff.suggested', 'ai.price.suggested',
  'shipment.quoted', 'shipment.booked', 'shipment.delivered',
] as const;

export class CreateWebhookDto {
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  url!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(21)
  @IsIn(EVENT_CHOICES as unknown as string[], { each: true })
  events!: string[];
}

export class ToggleWebhookDto {
  @IsBoolean()
  isActive!: boolean;
}

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get('event-types')
  @RequirePermissions('webhooks:read')
  @ApiOperation({ summary: 'All subscribable event types' })
  async eventTypes() {
    return this.webhooks.listEventTypes();
  }

  @Get()
  @RequirePermissions('webhooks:read')
  @ApiOperation({ summary: 'List webhook subscriptions (secrets never returned)' })
  async list() {
    return this.webhooks.list();
  }

  @Post()
  @RequirePermissions('webhooks:manage')
  @ApiOperation({
    summary: 'Create subscription — signing secret returned ONCE',
    description: 'Payloads are signed with X-WCO-Signature: sha256=<hmac> using the secret.',
  })
  async create(@Body() dto: CreateWebhookDto) {
    return this.webhooks.create(dto.url, dto.events as never[]);
  }

  @Patch(':id/toggle')
  @RequirePermissions('webhooks:manage')
  @ApiOperation({ summary: 'Enable/disable a subscription' })
  async toggle(@Param('id') id: string, @Body() dto: ToggleWebhookDto) {
    return this.webhooks.toggle(id, dto.isActive);
  }

  @Delete(':id')
  @RequirePermissions('webhooks:manage')
  @ApiOperation({ summary: 'Delete a subscription' })
  async remove(@Param('id') id: string) {
    return this.webhooks.remove(id);
  }
}
