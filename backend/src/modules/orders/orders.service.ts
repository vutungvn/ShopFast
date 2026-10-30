import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { Env } from '../../config/env.validation';
import { uniqueViolationFields } from '../../common/prisma/prisma-errors';
import { CartIssue } from '../cart/dto/cart-response.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CheckoutProblemDto, OrderResponseDto } from './dto/order-response.dto';
import { generateOrderCode } from './order-code';
import {
  Checkout,
  OrderWithItems,
  OrdersRepository,
  PayResult,
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
  constructor(
    private readonly orders: OrdersRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

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

  /** Thanh toán giả lập: chỉ đánh dấu PAID, không đụng tồn kho (đã trừ lúc đặt), số tiền là totalAmount đã chốt. */
  async pay(userId: string, orderId: string): Promise<OrderResponseDto> {
    const timeoutMinutes = this.config.get('ORDER_PAYMENT_TIMEOUT_MINUTES', {
      infer: true,
    });
    // Kiểm tra hạn ngay tại đây: job tự huỷ chạy trễ thì đơn quá hạn vẫn không thanh toán được
    const placedAfter = new Date(Date.now() - timeoutMinutes * 60_000);
    const result = await this.orders.markPaid(orderId, userId, placedAfter);
    if (result.paid) return OrderResponseDto.from(result.order);
    throw paymentError(result.current);
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

/** Lý do không thanh toán được, suy từ trạng thái hiện tại của đơn */
function paymentError(current: Extract<PayResult, { paid: false }>['current']) {
  // Đơn của người khác cũng trả 404 để không lộ đơn đó có tồn tại
  if (!current) return new NotFoundException('Không tìm thấy đơn hàng');
  switch (current.status) {
    case OrderStatus.CANCELLED:
      return new ConflictException('Đơn hàng đã bị huỷ');
    case OrderStatus.PENDING_PAYMENT:
      // Vẫn chờ thanh toán mà không cập nhật được => đã quá hạn (job tự huỷ chưa kịp chạy)
      return new ConflictException('Đơn đã quá hạn thanh toán');
    default:
      return new ConflictException('Đơn hàng đã được thanh toán');
  }
}
