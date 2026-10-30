import { ConflictException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { CheckoutLine } from '../cart/cart.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  Checkout,
  NewOrder,
  OrderWithItems,
  OrdersRepository,
} from './orders.repository';
import { OrdersService } from './orders.service';

const dto: CreateOrderDto = {
  recipientName: 'Nguyễn Văn An',
  recipientPhone: '0912345678',
  shippingAddress: '12 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
};

const line = (
  productId: string,
  price: string | number,
  quantity: number,
  isActive = true,
): CheckoutLine => ({
  productId,
  productName: `SP ${productId}`,
  price: new Prisma.Decimal(price),
  isActive,
  quantity,
});

/** Đơn giả dựng từ dữ liệu service gửi xuống, như Prisma trả về */
function savedOrder(order: NewOrder): OrderWithItems {
  return {
    id: 'o1',
    code: order.code,
    userId: order.userId,
    status: OrderStatus.PENDING_PAYMENT,
    totalAmount: order.totalAmount,
    shippingFee: order.shippingFee,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    shippingAddress: order.shippingAddress,
    paidAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: order.items.map((item, i) => ({
      id: `i${i}`,
      orderId: 'o1',
      ...item,
    })),
  };
}

/** Transaction giả: tồn kho trong bộ nhớ thay cho DB thật */
function fakeCheckout(lines: CheckoutLine[], stock: Record<string, number>) {
  const inventory = new Map(Object.entries(stock));
  const checkout: jest.Mocked<Checkout> = {
    cartLines: jest.fn(async () => lines),
    tryDecrementStock: jest.fn(async (productId, quantity) => {
      const current = inventory.get(productId) ?? 0;
      if (current < quantity) return { ok: false as const, stock: current };
      inventory.set(productId, current - quantity);
      return { ok: true as const };
    }),
    createOrder: jest.fn(async (order) => savedOrder(order)),
    clearCart: jest.fn(async () => {}),
  };
  const repo = {
    withCheckout: jest.fn((_userId, work) => work(checkout)),
  } as unknown as jest.Mocked<OrdersRepository>;
  return { checkout, repo, inventory, service: new OrdersService(repo) };
}

async function conflictBody(promise: Promise<unknown>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ConflictException);
  return (err as ConflictException).getResponse() as {
    message: string;
    items?: Array<{ productId: string; issue: string; stock: number }>;
  };
}

describe('OrdersService.placeOrder', () => {
  it('đặt thành công => trừ kho, lưu giá hiện tại, tính tổng, xoá giỏ', async () => {
    const { service, checkout, inventory } = fakeCheckout(
      [line('a', 22_990_000, 2), line('b', 150_000, 3)],
      { a: 10, b: 5 },
    );

    const order = await service.placeOrder('u1', dto);

    expect(inventory.get('a')).toBe(8);
    expect(inventory.get('b')).toBe(2);
    expect(order).toMatchObject({
      status: OrderStatus.PENDING_PAYMENT,
      recipientName: dto.recipientName,
      subtotal: 46_430_000,
      shippingFee: 0,
      totalAmount: 46_430_000,
    });
    expect(order.items).toEqual([
      expect.objectContaining({
        productId: 'a',
        unitPrice: 22_990_000,
        lineTotal: 45_980_000,
      }),
      expect.objectContaining({
        productId: 'b',
        unitPrice: 150_000,
        lineTotal: 450_000,
      }),
    ]);
    expect(order.code).toMatch(/^SF-\d{6}-[A-Z2-9]{4}$/);
    expect(checkout.clearCart).toHaveBeenCalledTimes(1);
  });

  it('tính tiền bằng Decimal, không sai số dấu phẩy động', async () => {
    const { service } = fakeCheckout([line('a', '0.1', 3)], { a: 10 });
    const order = await service.placeOrder('u1', dto);
    // 0.1 * 3 bằng number cho ra 0.30000000000000004
    expect(order.totalAmount).toBe(0.3);
  });

  it('giỏ trống => 409, không tạo đơn', async () => {
    const { service, checkout } = fakeCheckout([], {});
    const body = await conflictBody(service.placeOrder('u1', dto));
    expect(body.message).toBe('Giỏ hàng trống');
    expect(checkout.createOrder).not.toHaveBeenCalled();
  });

  it('có dòng lỗi => 409 liệt kê ĐỦ các dòng lỗi, không tạo đơn, không xoá giỏ', async () => {
    const { service, checkout } = fakeCheckout(
      [
        line('a', 100, 1),
        line('b', 100, 1, false),
        line('c', 100, 1),
        line('d', 100, 4),
      ],
      { a: 10, b: 10, c: 0, d: 2 },
    );

    const body = await conflictBody(service.placeOrder('u1', dto));

    expect(body.items).toEqual([
      expect.objectContaining({ productId: 'b', issue: 'INACTIVE' }),
      expect.objectContaining({
        productId: 'c',
        issue: 'OUT_OF_STOCK',
        stock: 0,
      }),
      expect.objectContaining({
        productId: 'd',
        issue: 'INSUFFICIENT_STOCK',
        stock: 2,
      }),
    ]);
    expect(body.message).toBe(
      'Một số sản phẩm không đủ hàng: SP b (ngừng bán), SP c (hết hàng), SP d (còn 2)',
    );
    expect(checkout.createOrder).not.toHaveBeenCalled();
    expect(checkout.clearCart).not.toHaveBeenCalled();
  });

  it('sản phẩm ngừng bán => không đụng tới tồn kho của nó', async () => {
    const { service, checkout } = fakeCheckout([line('a', 100, 1, false)], {
      a: 10,
    });
    await expect(service.placeOrder('u1', dto)).rejects.toThrow(
      ConflictException,
    );
    expect(checkout.tryDecrementStock).not.toHaveBeenCalled();
  });

  describe('mã đơn bị trùng', () => {
    const codeTaken = () =>
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['code'] },
      });

    it('trùng 1 lần => chạy lại transaction với mã mới và thành công', async () => {
      const { service, checkout, repo } = fakeCheckout([line('a', 100, 1)], {
        a: 10,
      });
      checkout.createOrder.mockRejectedValueOnce(codeTaken());

      const order = await service.placeOrder('u1', dto);

      expect(order.code).toMatch(/^SF-/);
      expect(repo.withCheckout).toHaveBeenCalledTimes(2);
      const [first, second] = checkout.createOrder.mock.calls.map(
        ([o]) => o.code,
      );
      expect(second).not.toBe(first);
    });

    it('trùng liên tục => dừng sau 3 lần, ném lỗi gốc', async () => {
      const { service, checkout, repo } = fakeCheckout([line('a', 100, 1)], {
        a: 10,
      });
      checkout.createOrder.mockRejectedValue(codeTaken());

      await expect(service.placeOrder('u1', dto)).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      );
      expect(repo.withCheckout).toHaveBeenCalledTimes(3);
    });

    it('lỗi khác => không chạy lại', async () => {
      const { service, checkout, repo } = fakeCheckout([line('a', 100, 1)], {
        a: 10,
      });
      checkout.createOrder.mockRejectedValue(new Error('db down'));

      await expect(service.placeOrder('u1', dto)).rejects.toThrow('db down');
      expect(repo.withCheckout).toHaveBeenCalledTimes(1);
    });
  });
});
