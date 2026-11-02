import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { AgentActionsService } from './agent-actions.service';
import {
  AgentActionDto,
  AgentActionQueryDto,
  RejectActionDto,
} from './dto/agent-action.dto';

const uuid = new ParseUUIDPipe({ version: '4' });

/** Đề xuất ghi dữ liệu của trợ lý AI chờ CSKH / admin duyệt */
@ApiTags('Support')
@ApiBearerAuth()
@Controller('agent-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPPORT, Role.ADMIN)
export class AgentActionsController {
  constructor(private readonly actions: AgentActionsService) {}

  /** Lọc `status=PENDING` cho hàng đợi chờ duyệt (cũ nhất trước) */
  @Get()
  list(
    @Query() query: AgentActionQueryDto,
  ): Promise<PaginatedResult<AgentActionDto>> {
    return this.actions.list(query);
  }

  /** Duyệt và thực thi ngay (huỷ đơn, trả kho). Đã có người xử lý => 409 */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
  ): Promise<AgentActionDto> {
    return this.actions.approve(user, id);
  }

  /** Từ chối, bắt buộc lý do (gửi vào hội thoại cho khách) */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: RejectActionDto,
  ): Promise<AgentActionDto> {
    return this.actions.reject(user, id, dto);
  }
}
