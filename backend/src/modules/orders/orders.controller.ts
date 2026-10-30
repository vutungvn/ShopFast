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
import { CancelOrderDto } from './dto/cancel-order.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { StaffOrderQueryDto } from './dto/staff-order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  OrderDetailDto,
  OrderResponseDto,
  OrderStatsDto,
  OrderSummaryDto,
  StaffOrderSummaryDto,
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

  /**
   * Danh sách đơn cho nhân viên (kho, admin; CSKH chỉ xem): lọc nhiều trạng thái, khoảng ngày đặt
   * `from`/`to` (giờ VN), tìm `q` theo mã đơn / SĐT người nhận, `sort=oldest` cho hàng đợi xử lý
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.WAREHOUSE, Role.ADMIN, Role.SUPPORT)
  listForStaff(
    @Query() query: StaffOrderQueryDto,
  ): Promise<PaginatedResult<StaffOrderSummaryDto>> {
    return this.orders.listForStaff(query);
  }

  /** Số đơn theo từng trạng thái (kho, admin, CSKH) */
  // Khai báo trước ':id' để "stats" không bị hiểu là id đơn
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.WAREHOUSE, Role.ADMIN, Role.SUPPORT)
  stats(): Promise<OrderStatsDto> {
    return this.orders.stats();
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
   * Kho đẩy đơn sang bước kế tiếp (kho, admin): PAID → CONFIRMED → PACKING → SHIPPING → DELIVERED.
   * `status` là trạng thái đích; không đúng bước kế tiếp (nhảy cóc, lùi, người khác vừa đổi) => 409.
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.WAREHOUSE, Role.ADMIN)
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderDetailDto> {
    return this.orders.updateStatus(user, id, dto);
  }

  /**
   * Huỷ đơn và trả kho ngay. Đơn đã thanh toán => ghi chú hoàn tiền giả lập.
   * Khách: đơn của mình, khi còn chờ thanh toán / đã thanh toán, lý do tuỳ chọn.
   * Kho / admin: mọi đơn, tới hết bước đóng gói, bắt buộc lý do (≥ 5 ký tự).
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.WAREHOUSE, Role.ADMIN)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    return this.orders.cancel(user, id, dto);
  }
}
