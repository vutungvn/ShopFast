import { OrderStatus } from '@prisma/client';
import { CartIssue } from '../../cart/dto/cart-response.dto';
import { OrderWithItems } from '../orders.repository';

export class OrderItemResponseDto {
  productId: string;
  /** Tên tại thời điểm đặt */
  productName: string;
  /** Đơn giá tại thời điểm đặt (VND) */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export class OrderResponseDto {
  id: string;
  /** @example SF-261030-K7QM */
  code: string;
  status: OrderStatus;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  items: OrderItemResponseDto[];
  /** Tổng tiền hàng (VND) */
  subtotal: number;
  shippingFee: number;
  /** subtotal + shippingFee (VND) */
  totalAmount: number;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;

  static from(order: OrderWithItems): OrderResponseDto {
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      shippingAddress: order.shippingAddress,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice.toNumber(),
        quantity: item.quantity,
        lineTotal: item.unitPrice.mul(item.quantity).toNumber(),
      })),
      subtotal: order.totalAmount.sub(order.shippingFee).toNumber(),
      shippingFee: order.shippingFee.toNumber(),
      totalAmount: order.totalAmount.toNumber(),
      paidAt: order.paidAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
    };
  }
}

/** Dòng không đặt được, trả trong body lỗi 409 để client đánh dấu đúng dòng trong giỏ */
export class CheckoutProblemDto {
  productId: string;
  productName: string;
  issue: CartIssue;
  /** Tồn kho hiện tại */
  stock: number;
}
