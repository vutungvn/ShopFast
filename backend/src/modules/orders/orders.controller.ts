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
import { CancelOrderDto } from './dto/cancel-order.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import {
  OrderDetailDto,
  OrderResponseDto,
  OrderSummaryDto,
} from './dto/order-response.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * Đặt đơn từ toàn bộ giỏ hàng (chỉ khách hàng). Giỏ trống hoặc có sản phẩm ngừng bán / không đủ hàng
   * => 409, body có `items` liệt kê các dòng lỗi; khi đó tồn kho và giỏ giữ nguyên.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.orders.placeOrder(user.id, dto);
  }

  /** Đơn của tôi (chỉ khách hàng): mới nhất trước, lọc nhiều trạng thái `status=PAID,CONFIRMED`, phân trang */
  // Khai báo trước ':id' để "me" không bị hiểu là id đơn
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  listMine(
    @CurrentUser() user: AuthUser,
    @Query() query: OrderQueryDto,
  ): Promise<PaginatedResult<OrderSummaryDto>> {
    return this.orders.listMine(user.id, query);
  }

  /**
   * Chi tiết đơn kèm lịch sử trạng thái. Khách chỉ xem đơn của mình (đơn khác => 404);
   * nhân viên (CSKH, kho, admin) xem mọi đơn và thấy ai đã đổi trạng thái.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.SUPPORT, Role.WAREHOUSE, Role.ADMIN)
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<OrderDetailDto> {
    return this.orders.getDetail(user, id);
  }

  /**
   * Thanh toán giả lập đơn PENDING_PAYMENT của chính mình (chỉ khách hàng). Đơn đã thanh toán, đã huỷ
   * hoặc quá hạn thanh toán => 409; đơn không tồn tại hoặc của người khác => 404.
   */
  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<OrderResponseDto> {
    return this.orders.pay(user.id, id);
  }

  /**
   * Khách huỷ đơn của mình khi đơn còn chờ thanh toán / đã thanh toán (đã thanh toán = hoàn tiền giả lập).
   * Hàng được trả lại kho ngay. Kho đã xác nhận trở đi hoặc đơn đã huỷ => 409; không có đơn => 404.
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    return this.orders.cancel(user.id, id, dto);
  }
}
