import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';

/** Giỏ hàng của khách đang đăng nhập. Mọi thao tác trả về toàn bộ giỏ. Nhân viên không có giỏ. */
@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  /** Xem giỏ (chưa có giỏ thì trả giỏ rỗng) */
  @Get()
  get(@CurrentUser() user: AuthUser): Promise<CartResponseDto> {
    return this.cart.getCart(user.id);
  }

  /** Thêm vào giỏ; sản phẩm đã có thì cộng dồn số lượng */
  @Post('items')
  @HttpCode(HttpStatus.OK)
  add(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cart.addItem(user.id, dto.productId, dto.quantity);
  }

  /** Đặt lại số lượng của một sản phẩm trong giỏ */
  @Patch('items/:productId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cart.updateItem(user.id, productId, dto.quantity);
  }

  /** Bỏ một sản phẩm khỏi giỏ */
  @Delete('items/:productId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
  ): Promise<CartResponseDto> {
    return this.cart.removeItem(user.id, productId);
  }

  /** Xoá hết giỏ */
  @Delete()
  clear(@CurrentUser() user: AuthUser): Promise<CartResponseDto> {
    return this.cart.clear(user.id);
  }
}
