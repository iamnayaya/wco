import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { UsersService } from './users.service';

export class UpdateRoleDto {
  @IsIn(['OWNER', 'ADMIN', 'AGENT', 'VIEWER'])
  role!: string;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('team:read')
  @ApiOperation({ summary: 'List merchant team members' })
  async list() {
    return this.users.list();
  }

  @Patch(':id/role')
  @RequirePermissions('team:manage')
  @ApiOperation({ summary: 'Change a team member role (owner only)' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: FastifyRequest,
  ) {
    const actorId = (req.user as { sub: string }).sub;
    return this.users.updateRole(actorId, id, dto.role);
  }

  @Delete(':id')
  @RequirePermissions('team:manage')
  @ApiOperation({ summary: 'Deactivate a team member' })
  async deactivate(@Param('id') id: string, @Req() req: FastifyRequest) {
    const actorId = (req.user as { sub: string }).sub;
    return this.users.deactivate(actorId, id);
  }
}
