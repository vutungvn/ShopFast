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

const detailInclude = {
  items: {
    orderBy: { productName: 'asc' },
    include: { product: { select: { slug: true } } },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
    include: {
      changedBy: { select: { id: true, fullName: true, role: true } },
    },
  },
} satisfies Prisma.OrderInclude;

/** Đơn kèm dòng sản phẩm (có slug để làm link) và lịch sử trạng thái kèm người đổi */
export type OrderDetail = Prisma.OrderGetPayload<{
  include: typeof detailInclude;
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

/** Kết quả thanh toán: không thanh toán được thì kèm trạng thái hiện tại (null = không có đơn của user này) */
export type PayResult =
  | { paid: true; order: OrderWithItems }
  | { paid: false; current: { status: OrderStatus } | null };

/** Đơn đã khoá trong transaction: đọc trạng thái rồi đổi mà không bị request khác chen giữa */
export interface LockedOrder {
  status: OrderStatus;
  /** Chuyển sang CANCELLED, trả kho mọi dòng, ghi lịch sử. Trả về đơn sau khi huỷ */
  cancel(changedById: string, note: string | null): Promise<OrderWithItems>;
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

  /** Đơn của một khách, mới nhất trước; lọc theo một hoặc nhiều trạng thái. Trả về [trang hiện tại, tổng số]. */
  listByUser(params: {
    userId: string;
    statuses?: OrderStatus[];
    skip: number;
    take: number;
  }): Promise<[OrderWithItems[], number]> {
    const where: Prisma.OrderWhereInput = {
      userId: params.userId,
      ...(params.statuses?.length && { status: { in: params.statuses } }),
    };
    return this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        // id phá hoà khi trùng thời điểm tạo để phân trang ổn định
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.order.count({ where }),
    ]);
  }

  /** Chi tiết đơn; truyền `userId` để chỉ tìm trong đơn của user đó (khách), bỏ trống cho nhân viên. */
  findDetail(orderId: string, userId?: string): Promise<OrderDetail | null> {
    return this.prisma.order.findFirst({
      where: { id: orderId, ...(userId && { userId }) },
      include: detailInclude,
    });
  }

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

  /**
   * Khoá dòng đơn (SELECT ... FOR UPDATE) tới hết transaction rồi chạy `work`; không có đơn của user
   * này thì `work` nhận null. Huỷ, thanh toán, kho đổi trạng thái trên cùng đơn vì vậy chạy lần lượt:
   * request đến sau thấy trạng thái mới nhất.
   */
  withLockedOrder<T>(
    orderId: string,
    userId: string,
    work: (order: LockedOrder | null) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ status: OrderStatus }[]>`
        SELECT status FROM orders
        WHERE id = ${orderId}::uuid AND "userId" = ${userId}::uuid
        FOR UPDATE`;
      return work(row ? lockedOrder(tx, orderId, row.status) : null);
    });
  }

  /**
   * Chuyển PENDING_PAYMENT -> PAID nếu đơn thuộc user và đặt sau `placedAfter` (chưa quá hạn).
   * Điều kiện nằm ngay trong câu UPDATE: thanh toán 2 lần, thanh toán cùng lúc huỷ đơn hay job tự huỷ
   * thì dòng đơn bị khoá, request đến sau thấy trạng thái đã đổi và cập nhật 0 dòng.
   */
  markPaid(
    orderId: string,
    userId: string,
    placedAfter: Date,
  ): Promise<PayResult> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: {
          id: orderId,
          userId,
          status: OrderStatus.PENDING_PAYMENT,
          createdAt: { gt: placedAfter },
        },
        data: { status: OrderStatus.PAID, paidAt: new Date() },
      });
      if (count === 0) {
        const current = await tx.order.findFirst({
          where: { id: orderId, userId },
          select: { status: true },
        });
        return { paid: false, current };
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: OrderStatus.PENDING_PAYMENT,
          toStatus: OrderStatus.PAID,
          changedById: userId,
          note: 'Thanh toán (giả lập)',
        },
      });
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderInclude,
      });
      return { paid: true, order };
    });
  }
}

function lockedOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  status: OrderStatus,
): LockedOrder {
  return {
    status,
    async cancel(changedById, note) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
      });
      // Trả kho theo thứ tự productId như lúc đặt đơn để không deadlock khi đặt và huỷ chạy cùng lúc.
      // Sản phẩm đã ngừng bán vẫn được cộng lại: tồn kho tách biệt với trạng thái bán.
      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { productId: true, quantity: true },
        orderBy: { productId: 'asc' },
      });
      for (const { productId, quantity } of items) {
        await tx.inventory.update({
          where: { productId },
          data: { stock: { increment: quantity } },
        });
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: status,
          toStatus: OrderStatus.CANCELLED,
          changedById,
          note,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderInclude,
      });
    },
  };
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
