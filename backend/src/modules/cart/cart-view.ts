import { Prisma } from '@prisma/client';
import { ProductResponseDto } from '../products/dto/product-response.dto';
import { ProductWithRelations } from '../products/products.repository';
import { CartIssue, CartResponseDto } from './dto/cart-response.dto';

export interface CartLine {
  product: ProductWithRelations;
  quantity: number;
}

export function lineIssue(
  isActive: boolean,
  stock: number,
  quantity: number,
): CartIssue | null {
  if (!isActive) return CartIssue.INACTIVE;
  if (stock <= 0) return CartIssue.OUT_OF_STOCK;
  if (stock < quantity) return CartIssue.INSUFFICIENT_STOCK;
  return null;
}

/** Dựng giỏ trả về client. Tính tiền bằng Decimal để không sai số dấu phẩy động. */
export function buildCartView(lines: CartLine[]): CartResponseDto {
  let subtotal = new Prisma.Decimal(0);
  let totalQuantity = 0;

  const items = lines.map(({ product, quantity }) => {
    const issue = lineIssue(
      product.isActive,
      product.inventory?.stock ?? 0,
      quantity,
    );
    const lineTotal = product.price.mul(quantity);
    if (!issue) {
      subtotal = subtotal.add(lineTotal);
      totalQuantity += quantity;
    }
    return {
      product: ProductResponseDto.from(product),
      quantity,
      lineTotal: lineTotal.toNumber(),
      issue,
    };
  });

  return {
    items,
    itemCount: items.length,
    totalQuantity,
    subtotal: subtotal.toNumber(),
    canCheckout: items.length > 0 && items.every((item) => !item.issue),
  };
}
