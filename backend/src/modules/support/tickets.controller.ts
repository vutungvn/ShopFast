import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { RateLimit } from '../../common/rate-limit/rate-limit.policies';
import {
  CreateTicketDto,
  TicketMessageDto,
  TicketQueryDto,
  UpdateTicketDto,
} from './dto/ticket-request.dto';
import { TicketDetailDto, TicketSummaryDto } from './dto/ticket-response.dto';
import { TicketsService } from './tickets.service';

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('Support')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  /** Khách tạo yêu cầu hỗ trợ: AI phân loại nhóm và trả lời tin đầu tiên */
  @Post()
  @RateLimit('ticket')
  @Roles(Role.CUSTOMER)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTicketDto,
  ): Promise<TicketDetailDto> {
    return this.tickets.create(user, dto);
  }

  /**
   * Khách: yêu cầu của mình. CSKH / admin: tất cả. Lọc `status`, `category`, `orderId`;
   * `open=true` chỉ lấy yêu cầu còn mở (mới cập nhật nhất trước)
   */
  @Get()
  @Roles(Role.CUSTOMER, Role.SUPPORT, Role.ADMIN)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: TicketQueryDto,
  ): Promise<PaginatedResult<TicketSummaryDto>> {
    return this.tickets.list(user, query);
  }

  /** Chi tiết + hội thoại + đề xuất của AI. Khách chỉ xem yêu cầu của mình */
  @Get(':id')
  @Roles(Role.CUSTOMER, Role.SUPPORT, Role.ADMIN)
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
  ): Promise<TicketDetailDto> {
    return this.tickets.detail(user, id);
  }

  /**
   * Gửi tin. Khách: trợ lý AI trả lời ngay nếu chưa có nhân viên tiếp nhận.
   * CSKH / admin: tiếp nhận yêu cầu, AI thôi trả lời. Yêu cầu đã đóng => 409.
   */
  @Post(':id/messages')
  @RateLimit('ticket-message')
  @Roles(Role.CUSTOMER, Role.SUPPORT, Role.ADMIN)
  addMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: TicketMessageDto,
  ): Promise<TicketDetailDto> {
    return this.tickets.addMessage(user, id, dto);
  }

  /**
   * CSKH / admin trả cuộc trò chuyện lại cho trợ lý AI (bỏ người xử lý, về Mới).
   * Đã đóng, AI đang trả lời sẵn hoặc chưa cấu hình AI => 409
   */
  @Post(':id/handback')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SUPPORT, Role.ADMIN)
  handBack(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
  ): Promise<TicketDetailDto> {
    return this.tickets.handBack(user, id);
  }

  /** CSKH / admin đổi trạng thái hoặc sửa nhóm */
  @Patch(':id')
  @Roles(Role.SUPPORT, Role.ADMIN)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateTicketDto,
  ): Promise<TicketDetailDto> {
    return this.tickets.update(user, id, dto);
  }
}
