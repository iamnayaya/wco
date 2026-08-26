import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { CustomersService } from './customers.service';

export class UpdateTagsDto {
  @IsArray()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags!: string[];
}

export class MarketingOptInDto {
  @IsBoolean()
  optedIn!: boolean;
}

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'customers', version: '1' })
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('crm:read')
  @ApiOperation({ summary: 'Search & list customers (cursor-paginated)' })
  async list(
    @Query('search') search?: string,
    @Query('segment') segment?: string,
    @Query('tag') tag?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '25',
  ) {
    return this.customers.list({ search, segment, tag, cursor, limit: Number(limit) });
  }

  @Get(':id')
  @RequirePermissions('crm:read')
  @ApiOperation({ summary: 'Customer 360 (profile + orders + conversations)' })
  async get(@Param('id') id: string) {
    return this.customers.get(id);
  }

  @Patch(':id/tags')
  @RequirePermissions('crm:write')
  @ApiOperation({ summary: 'Replace customer tags' })
  async updateTags(@Param('id') id: string, @Body() dto: UpdateTagsDto) {
    return this.customers.updateTags(id, dto.tags);
  }

  @Patch(':id/marketing-consent')
  @RequirePermissions('crm:write')
  @ApiOperation({ summary: 'Set marketing opt-in consent (audited)' })
  async setMarketingOptIn(@Param('id') id: string, @Body() dto: MarketingOptInDto) {
    return this.customers.setMarketingOptIn(id, dto.optedIn);
  }

  /** Data-subject rights endpoints — NDPR/GDPR compliance surface. */
  @Get(':id/export')
  @RequirePermissions('crm:read')
  @ApiOperation({ summary: 'Export all data held for this customer (GDPR Art. 20)' })
  async export(@Param('id') id: string) {
    return this.customers.export(id);
  }

  @Delete(':id')
  @RequirePermissions('crm:manage')
  @ApiOperation({
    summary: 'Erase customer PII (GDPR Art. 17). Financial records are anonymized, not deleted.',
  })
  async erase(@Param('id') id: string, @Req() req: FastifyRequest) {
    const actorId = (req.user as { sub: string }).sub;
    return this.customers.erase(id, actorId);
  }
}
