import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { uniqueViolationFields } from '../../common/prisma/prisma-errors';
import { CartIssue } from '../cart/dto/cart-response.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CheckoutProblemDto, OrderResponseDto } from './dto/order-response.dto';
import { generateOrderCode } from './order-code';
import {
  Checkout,
  OrderWithItems,
  OrdersRepository,
} from './orders.repository';

/** Số lần tạo lại mã khi trùng; 32^4 mã/ngày nên trùng 3 lần liên tiếp gần như không thể */
const MAX_CODE_ATTEMPTS = 3;

const ISSUE_LABELS: Record<CartIssue, (stock: number) => string> = {
  [CartIssue.INACTIVE]: () => 'ngừng bán',
  [CartIssue.OUT_OF_STOCK]: () => 'hết hàng',
  [CartIssue.INSUFFICIENT_STOCK]: (stock) => `còn ${stock}`,
};

@Injectable()
export class OrdersService {
  constructor(private readonly orders: OrdersRepository) {}

  /** Đặt đơn từ toàn bộ giỏ: trừ kho, lưu giá tại thời điểm đặt, xoá giỏ, tất cả trong một transaction. */
  async placeOrder(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    for (let attempt = 1; ; attempt++) {
      try {
        const order = await this.orders.withCheckout(userId, (checkout) =>
          this.checkout(checkout, userId, dto),
        );
        return OrderResponseDto.from(order);
      } catch (err) {
        // Lỗi trong transaction làm Postgres huỷ cả transaction nên phải chạy lại từ đầu
        const codeTaken = uniqueViolationFields(err)?.includes('code');
        if (codeTaken && attempt < MAX_CODE_ATTEMPTS) continue;
        throw err;
      }
    }
  }

  private async checkout(
    checkout: Checkout,
    userId: string,
    dto: CreateOrderDto,
  ): Promise<OrderWithItems> {
    const lines = await checkout.cartLines();
    if (lines.length === 0) throw new ConflictException('Giỏ hàng trống');

    // Kiểm tra hết các dòng (không dừng ở dòng lỗi đầu tiên) để báo đủ cho khách một lần
    const problems: CheckoutProblemDto[] = [];
    for (const line of lines) {
      const problem = (issue: CartIssue, stock: number) =>
        problems.push({
          productId: line.productId,
          productName: line.productName,
          issue,
          stock,
        });

      if (!line.isActive) {
        problem(CartIssue.INACTIVE, 0);
        continue;
      }
      const result = await checkout.tryDecrementStock(
        line.productId,
        line.quantity,
      );
      if (!result.ok) {
        problem(
          result.stock <= 0
            ? CartIssue.OUT_OF_STOCK
            : CartIssue.INSUFFICIENT_STOCK,
          result.stock,
        );
      }
    }
    if (problems.length > 0) {
      // Throw để transaction hoàn lại các dòng đã trừ kho; giỏ giữ nguyên
      const summary = problems
        .map((p) => `${p.productName} (${ISSUE_LABELS[p.issue](p.stock)})`)
        .join(', ');
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Một số sản phẩm không đủ hàng: ${summary}`,
        items: problems,
      });
    }

    const shippingFee = new Prisma.Decimal(0);
    const subtotal = lines.reduce(
      (sum, line) => sum.add(line.price.mul(line.quantity)),
      new Prisma.Decimal(0),
    );
    const order = await checkout.createOrder({
      code: generateOrderCode(),
      userId,
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      shippingAddress: dto.shippingAddress,
      shippingFee,
      totalAmount: subtotal.add(shippingFee),
      items: lines.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        unitPrice: line.price,
        quantity: line.quantity,
      })),
    });
    await checkout.clearCart();
    return order;
  }
}
