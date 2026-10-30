import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { Env } from '../../config/env.validation';
import { CheckoutLine } from '../cart/cart.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  Checkout,
  LockedOrder,
  NewOrder,
  OrderWithItems,
  OrdersRepository,
  PayResult,
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

const TIMEOUT_MINUTES = 60;
const config = {
  get: () => TIMEOUT_MINUTES,
} as unknown as ConfigService<Env, true>;

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
  return {
    checkout,
    repo,
    inventory,
    service: new OrdersService(repo, config),
  };
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

describe('OrdersService.pay', () => {
  function setup(result: PayResult) {
    const repo = {
      markPaid: jest.fn().mockResolvedValue(result),
    } as unknown as jest.Mocked<OrdersRepository>;
    return { repo, service: new OrdersService(repo, config) };
  }

  const paidOrder = (): OrderWithItems => ({
    ...savedOrder({
      code: 'SF-261030-AAAA',
      userId: 'u1',
      ...dto,
      shippingFee: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(500),
      items: [],
    }),
    status: OrderStatus.PAID,
    paidAt: new Date(),
  });

  it('thành công => trả đơn PAID', async () => {
    const { service } = setup({ paid: true, order: paidOrder() });
    const order = await service.pay('u1', 'o1');
    expect(order.status).toBe(OrderStatus.PAID);
    expect(order.paidAt).toBeInstanceOf(Date);
  });

  it('chỉ nhận đơn đặt trong hạn thanh toán (cấu hình theo phút)', async () => {
    const { service, repo } = setup({ paid: true, order: paidOrder() });
    const before = Date.now();
    await service.pay('u1', 'o1');

    const placedAfter = (repo.markPaid.mock.calls[0][2] as Date).getTime();
    expect(placedAfter).toBeGreaterThanOrEqual(
      before - TIMEOUT_MINUTES * 60_000,
    );
    expect(placedAfter).toBeLessThanOrEqual(
      Date.now() - TIMEOUT_MINUTES * 60_000,
    );
    expect(repo.markPaid).toHaveBeenCalledWith('o1', 'u1', expect.any(Date));
  });

  it('không có đơn của user này => 404', async () => {
    const { service } = setup({ paid: false, current: null });
    await expect(service.pay('u1', 'o1')).rejects.toThrow(NotFoundException);
  });

  it.each([
    [OrderStatus.CANCELLED, 'Đơn hàng đã bị huỷ'],
    [OrderStatus.PENDING_PAYMENT, 'Đơn đã quá hạn thanh toán'],
    [OrderStatus.PAID, 'Đơn hàng đã được thanh toán'],
    [OrderStatus.SHIPPING, 'Đơn hàng đã được thanh toán'],
  ])('đơn đang %s => 409 "%s"', async (status, message) => {
    const { service } = setup({ paid: false, current: { status } });
    const body = await conflictBody(service.pay('u1', 'o1'));
    expect(body.message).toBe(message);
  });
});

describe('OrdersService.cancel', () => {
  /** Đơn khoá giả ở trạng thái cho trước; null = không có đơn của user này */
  function setup(status: OrderStatus | null) {
    const cancelled = {
      ...savedOrder({
        code: 'SF-261030-AAAA',
        userId: 'u1',
        ...dto,
        shippingFee: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(500),
        items: [],
      }),
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
    };
    const locked: jest.Mocked<LockedOrder> | null = status
      ? { status, cancel: jest.fn().mockResolvedValue(cancelled) }
      : null;
    const repo = {
      withLockedOrder: jest.fn((_id, _userId, work) => work(locked)),
    } as unknown as jest.Mocked<OrdersRepository>;
    return { locked, repo, service: new OrdersService(repo, config) };
  }

  it('đơn chờ thanh toán => huỷ, ghi lý do khách nhập', async () => {
    const { service, locked } = setup(OrderStatus.PENDING_PAYMENT);
    const order = await service.cancel('u1', 'o1', { reason: 'Đặt nhầm' });
    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(locked?.cancel).toHaveBeenCalledWith('u1', 'Đặt nhầm');
  });

  it('không nhập lý do (hoặc chỉ khoảng trắng đã bị cắt) => note null', async () => {
    const { service, locked } = setup(OrderStatus.PENDING_PAYMENT);
    await service.cancel('u1', 'o1', { reason: '' });
    expect(locked?.cancel).toHaveBeenCalledWith('u1', null);
  });

  it('đơn đã thanh toán => huỷ kèm ghi chú hoàn tiền giả lập', async () => {
    const { service, locked } = setup(OrderStatus.PAID);
    await service.cancel('u1', 'o1', { reason: 'Đổi ý' });
    expect(locked?.cancel).toHaveBeenCalledWith(
      'u1',
      'Đổi ý · Hoàn tiền (giả lập)',
    );
  });

  it('không có đơn của user này => 404', async () => {
    const { service } = setup(null);
    await expect(service.cancel('u1', 'o1', {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each([
    [OrderStatus.CANCELLED, 'Đơn hàng đã bị huỷ'],
    [OrderStatus.CONFIRMED, 'Đơn hàng đã được xử lý, không thể huỷ'],
    [OrderStatus.PACKING, 'Đơn hàng đã được xử lý, không thể huỷ'],
    [OrderStatus.SHIPPING, 'Đơn hàng đã được xử lý, không thể huỷ'],
    [OrderStatus.DELIVERED, 'Đơn hàng đã được xử lý, không thể huỷ'],
  ])('đơn đang %s => 409 "%s", không huỷ', async (status, message) => {
    const { service, locked } = setup(status);
    const body = await conflictBody(service.cancel('u1', 'o1', {}));
    expect(body.message).toBe(message);
    expect(locked?.cancel).not.toHaveBeenCalled();
  });
});
