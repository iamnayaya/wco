import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { MarketingService } from './marketing.service';

export class CreateCampaignDto {
  @IsIn(['ABANDONED_CART', 'FOLLOW_UP', 'PROMOTION', 'WINBACK', 'REVIEW_REQUEST'])
  type!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsObject()
  audienceFilter!: Record<string, unknown>;

  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  messageBody!: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}

export class PreviewAudienceDto {
  @IsObject()
  audienceFilter!: Record<string, unknown>;
}

export class CreateRuleDto {
  @IsIn(['ORDER_PAID', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'CART_ABANDONED', 'NEW_CUSTOMER', 'FOLLOW_UP_DUE', 'KEYWORD'])
  trigger!: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  messageBody!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  delayMinutes?: number;
}

export class ToggleRuleDto {
  @IsBoolean()
  enabled!: boolean;
}

@ApiTags('marketing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'marketing', version: '1' })
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  // ---- Campaigns ----
  @Get('campaigns')
  @RequirePermissions('marketing:read')
  @ApiOperation({ summary: 'List campaigns with send stats' })
  async listCampaigns() {
    return this.marketing.listCampaigns();
  }

  @Post('campaigns')
  @RequirePermissions('marketing:create')
  @ApiOperation({ summary: 'Create a campaign (draft or scheduled)' })
  async createCampaign(@Body() dto: CreateCampaignDto) {
    return this.marketing.createCampaign({
      type: dto.type,
      name: dto.name,
      audienceFilter: dto.audienceFilter,
      messageBody: dto.messageBody,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
    });
  }

  @Post('campaigns/preview-audience')
  @RequirePermissions('marketing:read')
  @ApiOperation({ summary: 'Count matching customers before launching' })
  async previewAudience(@Body() dto: PreviewAudienceDto) {
    return this.marketing.previewAudience(dto.audienceFilter);
  }

  @Post('campaigns/:id/launch')
  @RequirePermissions('marketing:create')
  @ApiOperation({ summary: 'Launch campaign (async fan-out via workers)' })
  async launch(@Param('id') id: string) {
    return this.marketing.launchCampaign(id);
  }

  // ---- Automation rules ----
  @Get('rules')
  @RequirePermissions('marketing:read')
  @ApiOperation({ summary: 'List automation rules' })
  async listRules() {
    return this.marketing.listRules();
  }

  @Post('rules')
  @RequirePermissions('marketing:create')
  @ApiOperation({ summary: 'Create automation rule (e.g. abandoned cart nudge)' })
  async createRule(@Body() dto: CreateRuleDto) {
    return this.marketing.createRule(dto);
  }

  @Patch('rules/:id/toggle')
  @RequirePermissions('marketing:create')
  @ApiOperation({ summary: 'Enable/disable an automation rule' })
  async toggleRule(@Param('id') id: string, @Body() dto: ToggleRuleDto) {
    return this.marketing.toggleRule(id, dto.enabled);
  }
}
