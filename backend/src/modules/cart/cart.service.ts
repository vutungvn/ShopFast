import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MAX_CART_ITEMS, MAX_QUANTITY_PER_ITEM } from './cart.constants';
import { CartRepository, ProductForCart } from './cart.repository';
import { buildCartView } from './cart-view';
import { CartResponseDto } from './dto/cart-response.dto';

@Injectable()
export class CartService {
  constructor(private readonly cart: CartRepository) {}

  async getCart(userId: string): Promise<CartResponseDto> {
    return buildCartView(await this.cart.findLines(userId));
  }

  /** Thêm vào giỏ: sản phẩm đã có thì cộng dồn số lượng. */
  async addItem(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartResponseDto> {
    await this.cart.withLockedCart(userId, async (cart) => {
      const product = await cart.findProduct(productId);
      if (!product?.isActive) {
        throw new NotFoundException('Không tìm thấy sản phẩm');
      }
      const current = (await cart.findQuantity(productId)) ?? 0;
      const next = current + quantity;
      const inCart = current > 0 ? ` (giỏ đã có ${current})` : '';

      if (next > MAX_QUANTITY_PER_ITEM) {
        throw new BadRequestException(
          `Tối đa ${MAX_QUANTITY_PER_ITEM} sản phẩm mỗi loại${inCart}`,
        );
      }
      assertInStock(product, next, inCart);
      if (current === 0 && (await cart.countItems()) >= MAX_CART_ITEMS) {
        throw new BadRequestException(
          `Giỏ hàng tối đa ${MAX_CART_ITEMS} loại sản phẩm`,
        );
      }
      await cart.setQuantity(productId, next);
    });
    return this.getCart(userId);
  }

  /** Đặt lại số lượng của sản phẩm đã có trong giỏ (không cộng dồn). */
  async updateItem(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartResponseDto> {
    await this.cart.withLockedCart(userId, async (cart) => {
      if ((await cart.findQuantity(productId)) === null) {
        throw new NotFoundException('Sản phẩm không có trong giỏ');
      }
      const product = await cart.findProduct(productId);
      if (!product?.isActive) {
        throw new ConflictException(
          'Sản phẩm đã ngừng bán, vui lòng xoá khỏi giỏ',
        );
      }
      assertInStock(product, quantity, '');
      await cart.setQuantity(productId, quantity);
    });
    return this.getCart(userId);
  }

  async removeItem(
    userId: string,
    productId: string,
  ): Promise<CartResponseDto> {
    if ((await this.cart.removeItem(userId, productId)) === 0) {
      throw new NotFoundException('Sản phẩm không có trong giỏ');
    }
    return this.getCart(userId);
  }

  async clear(userId: string): Promise<CartResponseDto> {
    await this.cart.clear(userId);
    return this.getCart(userId);
  }
}

/**
 * Giỏ không giữ chỗ tồn kho: kiểm tra ở đây chỉ để báo sớm cho khách.
 * Chống bán vượt thật sự nằm ở bước đặt đơn (trừ kho nguyên tử).
 */
function assertInStock(
  product: ProductForCart,
  quantity: number,
  inCart: string,
) {
  if (product.stock <= 0) {
    throw new ConflictException('Sản phẩm đã hết hàng');
  }
  if (quantity > product.stock) {
    throw new ConflictException(
      `Chỉ còn ${product.stock} sản phẩm trong kho${inCart}`,
    );
  }
}
