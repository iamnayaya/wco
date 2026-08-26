import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { ProductsService } from './products.service';
import { CreateProductDto, AdjustStockDto } from './dto/create-product.dto';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions('catalog:read')
  @ApiOperation({ summary: 'List products (search + cursor pagination)' })
  async list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '25',
  ) {
    return this.products.list({ search, status, cursor, limit: Number(limit) });
  }

  @Get('low-stock')
  @RequirePermissions('catalog:read')
  @ApiOperation({ summary: 'Products at or below their low-stock threshold' })
  async lowStock() {
    return this.products.lowStock();
  }

  @Post()
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Create product' })
  async create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Update product fields' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateProductDto>) {
    return this.products.update(id, dto);
  }

  @Patch(':id/stock')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Atomic stock adjustment (restock or correction)' })
  async adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.products.adjustStock(id, dto.delta);
  }

  @Delete(':id')
  @RequirePermissions('catalog:write')
  @ApiOperation({ summary: 'Soft-delete (archive) a product' })
  async remove(@Param('id') id: string) {
    return this.products.softDelete(id);
  }
}
