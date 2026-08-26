import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { StoresService } from './stores.service';
import { CreateStoreDto, ConnectWhatsappDto } from './dto/create-store.dto';

@ApiTags('stores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'stores', version: '1' })
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  @RequirePermissions('store:read')
  @ApiOperation({ summary: 'List all stores owned by the merchant' })
  async list() {
    return this.stores.list();
  }

  @Get(':id')
  @RequirePermissions('store:read')
  @ApiOperation({ summary: 'Store detail with counters' })
  async get(@Param('id') id: string) {
    return this.stores.get(id);
  }

  @Post()
  @RequirePermissions('store:create')
  @ApiOperation({ summary: 'Create an additional store (multi-store support)' })
  async create(@Body() dto: CreateStoreDto) {
    return this.stores.create(dto);
  }

  @Post(':id/whatsapp')
  @RequirePermissions('store:update')
  @ApiOperation({
    summary: 'Connect a WhatsApp Business number to this store',
    description: 'Number is globally unique across the platform. E.164 format required.',
  })
  async connectWhatsapp(@Param('id') id: string, @Body() dto: ConnectWhatsappDto) {
    return this.stores.connectWhatsapp(id, dto.whatsappNumber, dto.whatsappNameId);
  }
}
