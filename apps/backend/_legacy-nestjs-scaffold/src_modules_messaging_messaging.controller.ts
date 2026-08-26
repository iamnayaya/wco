import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard, RequirePermissions } from '../../common/guards/tenant.guard';
import { MessagingService } from './messaging.service';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  body!: string;
}

export class ToggleBotDto {
  @IsBoolean()
  enabled!: boolean;
}

@ApiTags('messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller({ path: 'conversations', version: '1' })
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  @RequirePermissions('inbox:read')
  @ApiOperation({ summary: 'Inbox: list conversations (newest first)' })
  async list(
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '25',
  ) {
    return this.messaging.listConversations({ status, cursor, limit: Number(limit) });
  }

  @Get(':id/messages')
  @RequirePermissions('inbox:read')
  @ApiOperation({ summary: 'Message history for a conversation (marks as read)' })
  async messages(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '50',
  ) {
    return this.messaging.getMessages(id, cursor, Number(limit));
  }

  @Post(':id/messages')
  @RequirePermissions('inbox:reply')
  @ApiOperation({
    summary: 'Send an agent reply via WhatsApp',
    description: 'Takes over the conversation — AI bot stands down until re-enabled.',
  })
  async send(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Req() req: FastifyRequest,
  ) {
    const agentId = (req.user as { sub: string }).sub;
    return this.messaging.sendAgentMessage(id, agentId, dto.body);
  }

  @Patch(':id/assign')
  @RequirePermissions('inbox:reply')
  @ApiOperation({ summary: 'Assign conversation to self (take over from AI)' })
  async assign(@Param('id') id: string, @Req() req: FastifyRequest) {
    const agentId = (req.user as { sub: string }).sub;
    return this.messaging.assignAgent(id, agentId);
  }

  @Patch(':id/bot')
  @RequirePermissions('inbox:manage')
  @ApiOperation({ summary: 'Enable/disable AI auto-responder on a conversation' })
  async toggleBot(@Param('id') id: string, @Body() dto: ToggleBotDto) {
    return this.messaging.toggleBot(id, dto.enabled);
  }
}
