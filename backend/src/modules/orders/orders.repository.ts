import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  CartRepository,
  CheckoutCart,
  CheckoutLine,
} from '../cart/cart.repository';

const orderInclude = {
  items: { orderBy: { productName: 'asc' } },
} satisfies Prisma.OrderInclude;

export type OrderWithItems = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

export interface NewOrder {
  code: string;
  userId: string;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  shippingFee: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  items: Array<{
    productId: string;
    productName: string;
    unitPrice: Prisma.Decimal;
    quantity: number;
  }>;
}

/** Các thao tác của MỘT lần đặt đơn, chạy trong transaction đang giữ khoá giỏ của user. */
export interface Checkout {
  cartLines(): Promise<CheckoutLine[]>;
  /**
   * Trừ kho nguyên tử, chỉ khi còn đủ hàng. Không đủ thì không trừ và trả về tồn kho hiện tại.
   * Hai đơn cùng mua món cuối: dòng tồn kho bị khoá nên UPDATE thứ hai chờ, rồi thấy stock < q.
   */
  tryDecrementStock(
    productId: string,
    quantity: number,
  ): Promise<{ ok: true } | { ok: false; stock: number }>;
  createOrder(order: NewOrder): Promise<OrderWithItems>;
  clearCart(): Promise<void>;
}

@Injectable()
export class OrdersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartRepository,
  ) {}

  /** Chạy `work` trong một transaction; `work` throw thì mọi thay đổi (kể cả tồn kho đã trừ) được hoàn lại. */
  withCheckout<T>(
    userId: string,
    work: (checkout: Checkout) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        const cart = await this.cart.lockForCheckout(tx, userId);
        return work(checkout(tx, cart));
      },
      // Xếp hàng sau các thao tác khác trên cùng giỏ: chờ lâu hơn mặc định (2s/5s) như giỏ hàng
      { maxWait: 10_000, timeout: 15_000 },
    );
  }
}

function checkout(tx: Prisma.TransactionClient, cart: CheckoutCart): Checkout {
  return {
    cartLines: () => cart.lines(),
    clearCart: () => cart.clear(),
    async tryDecrementStock(productId, quantity) {
      const updated = await tx.$executeRaw`
        UPDATE inventories SET stock = stock - ${quantity}, "updatedAt" = now()
        WHERE "productId" = ${productId}::uuid AND stock >= ${quantity}`;
      if (updated === 1) return { ok: true };
      const inventory = await tx.inventory.findUnique({
        where: { productId },
        select: { stock: true },
      });
      return { ok: false, stock: inventory?.stock ?? 0 };
    },
    createOrder({ items, ...order }) {
      return tx.order.create({
        data: {
          ...order,
          items: { create: items },
          statusHistory: {
            create: {
              toStatus: OrderStatus.PENDING_PAYMENT,
              changedById: order.userId,
            },
          },
        },
        include: orderInclude,
      });
    },
  };
}
