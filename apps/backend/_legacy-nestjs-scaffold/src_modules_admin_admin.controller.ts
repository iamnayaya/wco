import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiSecurity, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin-api-key.guard';
import { AdminService } from './admin.service';

/**
 * Internal admin endpoints — consumed by apps/admin-dashboard only.
 * Auth: X-Admin-Token header checked by AdminGuard (NOT merchant JWT).
 */
@ApiTags('admin')
@ApiSecurity('AdminToken')
@UseGuards(AdminGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform-wide ops metrics' })
  overview() {
    return this.admin.overview();
  }

  @Get('merchants')
  @ApiQuery({ name: 'page', required: false })
  @ApiOperation({ summary: 'Paginated merchant list' })
  merchants(@Query('page') page = '1') {
    return this.admin.merchants(Math.max(1, Number(page) || 1));
  }

  @Get('incidents')
  @ApiOperation({ summary: 'Open incidents feed' })
  incidents() {
    return this.admin.incidents();
  }
}
