import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
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
