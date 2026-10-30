import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { Env } from '../../config/env.validation';
import { CheckoutLine } from '../cart/cart.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { StaffOrderQueryDto } from './dto/staff-order-query.dto';
import {
  Checkout,
  LockedOrder,
  NewOrder,
  OrderDetail,
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

const customerActor = { id: 'u1', email: 'a@b.c', role: Role.CUSTOMER };
const warehouseActor = { id: 's1', email: 'k@b.c', role: Role.WAREHOUSE };

/** Đơn khoá giả ở trạng thái cho trước; null = không thấy đơn */
function lockedSetup(status: OrderStatus | null, paidAt: Date | null = null) {
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
    ? {
        status,
        paidAt,
        cancel: jest.fn().mockResolvedValue(cancelled),
        changeStatus: jest.fn(),
      }
    : null;
  const repo = {
    withLockedOrder: jest.fn((_id, _userId, work) => work(locked)),
  } as unknown as jest.Mocked<OrdersRepository>;
  return { locked, repo, service: new OrdersService(repo, config) };
}

describe('OrdersService.cancel – khách', () => {
  it('chỉ tìm trong đơn của chính khách', async () => {
    const { service, repo } = lockedSetup(OrderStatus.PENDING_PAYMENT);
    await service.cancel(customerActor, 'o1', {});
    expect(repo.withLockedOrder).toHaveBeenCalledWith(
      'o1',
      'u1',
      expect.any(Function),
    );
  });

  it('đơn chờ thanh toán => huỷ, ghi lý do khách nhập', async () => {
    const { service, locked } = lockedSetup(OrderStatus.PENDING_PAYMENT);
    const order = await service.cancel(customerActor, 'o1', {
      reason: 'Đặt nhầm',
    });
    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(locked?.cancel).toHaveBeenCalledWith('u1', 'Đặt nhầm');
  });

  it('không nhập lý do (hoặc chỉ khoảng trắng đã bị cắt) => note null', async () => {
    const { service, locked } = lockedSetup(OrderStatus.PENDING_PAYMENT);
    await service.cancel(customerActor, 'o1', { reason: '' });
    expect(locked?.cancel).toHaveBeenCalledWith('u1', null);
  });

  it('đơn đã thanh toán => huỷ kèm ghi chú hoàn tiền giả lập', async () => {
    const { service, locked } = lockedSetup(OrderStatus.PAID, new Date());
    await service.cancel(customerActor, 'o1', { reason: 'Đổi ý' });
    expect(locked?.cancel).toHaveBeenCalledWith(
      'u1',
      'Đổi ý · Hoàn tiền (giả lập)',
    );
  });

  it('không có đơn của user này => 404', async () => {
    const { service } = lockedSetup(null);
    await expect(service.cancel(customerActor, 'o1', {})).rejects.toThrow(
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
    const { service, locked } = lockedSetup(status);
    const body = await conflictBody(service.cancel(customerActor, 'o1', {}));
    expect(body.message).toBe(message);
    expect(locked?.cancel).not.toHaveBeenCalled();
  });
});

describe('OrdersService.cancel – nhân viên', () => {
  it('tìm mọi đơn (không lọc theo chủ đơn)', async () => {
    const { service, repo } = lockedSetup(OrderStatus.PACKING, new Date());
    await service.cancel(warehouseActor, 'o1', { reason: 'Hết hàng thật' });
    expect(repo.withLockedOrder).toHaveBeenCalledWith(
      'o1',
      undefined,
      expect.any(Function),
    );
  });

  it.each([undefined, '', 'abc'])(
    'lý do "%s" (thiếu hoặc dưới 5 ký tự) => 400, không khoá đơn',
    async (reason) => {
      const { service, repo } = lockedSetup(OrderStatus.PAID);
      await expect(
        service.cancel(warehouseActor, 'o1', { reason }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.withLockedOrder).not.toHaveBeenCalled();
    },
  );

  it('đơn đang đóng gói, đã thanh toán => huỷ, người huỷ là nhân viên, ghi hoàn tiền', async () => {
    const { service, locked } = lockedSetup(OrderStatus.PACKING, new Date());
    await service.cancel(warehouseActor, 'o1', {
      reason: 'Khách không nghe máy',
    });
    expect(locked?.cancel).toHaveBeenCalledWith(
      's1',
      'Khách không nghe máy · Hoàn tiền (giả lập)',
    );
  });

  it('đơn chưa thanh toán => không ghi hoàn tiền', async () => {
    const { service, locked } = lockedSetup(OrderStatus.PENDING_PAYMENT);
    await service.cancel(warehouseActor, 'o1', {
      reason: 'Đơn nghi ngờ gian lận',
    });
    expect(locked?.cancel).toHaveBeenCalledWith('s1', 'Đơn nghi ngờ gian lận');
  });

  it.each([
    [OrderStatus.SHIPPING, "Không thể huỷ đơn đang ở trạng thái 'Đang giao'"],
    [OrderStatus.DELIVERED, "Không thể huỷ đơn đang ở trạng thái 'Đã giao'"],
    [OrderStatus.CANCELLED, 'Đơn hàng đã bị huỷ'],
  ])('đơn đang %s => 409 "%s"', async (status, message) => {
    const { service, locked } = lockedSetup(status, new Date());
    const body = await conflictBody(
      service.cancel(warehouseActor, 'o1', { reason: 'Lý do hợp lệ' }),
    );
    expect(body.message).toBe(message);
    expect(locked?.cancel).not.toHaveBeenCalled();
  });
});

describe('OrdersService.updateStatus', () => {
  function withDetail(status: OrderStatus) {
    const setup = lockedSetup(status, new Date());
    const order = savedOrder({
      code: 'SF-261030-AAAA',
      userId: 'u1',
      ...dto,
      shippingFee: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(500),
      items: [],
    });
    setup.locked?.changeStatus.mockImplementation(async (toStatus) => ({
      ...order,
      status: toStatus,
      items: [],
      statusHistory: [],
      user: { id: 'u1', fullName: 'Khách', email: 'a@b.c' },
    }));
    return setup;
  }

  it.each([
    [OrderStatus.PAID, OrderStatus.CONFIRMED],
    [OrderStatus.CONFIRMED, OrderStatus.PACKING],
    [OrderStatus.PACKING, OrderStatus.SHIPPING],
    [OrderStatus.SHIPPING, OrderStatus.DELIVERED],
  ])('%s -> %s => đổi, ghi người đổi và ghi chú', async (from, to) => {
    const { service, locked, repo } = withDetail(from);
    const order = await service.updateStatus(warehouseActor, 'o1', {
      status: to,
      note: 'ok',
    });
    expect(order.status).toBe(to);
    expect(locked?.changeStatus).toHaveBeenCalledWith(to, 's1', 'ok');
    expect(repo.withLockedOrder).toHaveBeenCalledWith(
      'o1',
      undefined,
      expect.any(Function),
    );
  });

  it('ghi chú rỗng => null', async () => {
    const { service, locked } = withDetail(OrderStatus.PAID);
    await service.updateStatus(warehouseActor, 'o1', {
      status: OrderStatus.CONFIRMED,
      note: '',
    });
    expect(locked?.changeStatus).toHaveBeenCalledWith(
      OrderStatus.CONFIRMED,
      's1',
      null,
    );
  });

  it.each([
    // nhảy cóc
    [OrderStatus.PAID, OrderStatus.SHIPPING],
    // lùi bước
    [OrderStatus.PACKING, OrderStatus.CONFIRMED],
    // người khác vừa đổi
    [OrderStatus.CONFIRMED, OrderStatus.CONFIRMED],
    // chưa thanh toán
    [OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED],
    // đã kết thúc
    [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    // đã huỷ
    [OrderStatus.CANCELLED, OrderStatus.CONFIRMED],
  ])('%s -> %s => 409 kèm trạng thái hiện tại', async (from, to) => {
    const { service, locked } = withDetail(from);
    const body = await conflictBody(
      service.updateStatus(warehouseActor, 'o1', { status: to }),
    );
    expect(body.message).toMatch(/^Không thể chuyển đơn từ '.+' sang '.+'$/);
    expect((body as { currentStatus?: string }).currentStatus).toBe(from);
    expect(locked?.changeStatus).not.toHaveBeenCalled();
  });

  it('không thấy đơn => 404', async () => {
    const { service } = lockedSetup(null);
    await expect(
      service.updateStatus(warehouseActor, 'o1', {
        status: OrderStatus.CONFIRMED,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('OrdersService.listForStaff', () => {
  function setup() {
    const repo = {
      listForStaff: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as jest.Mocked<OrdersRepository>;
    return { repo, service: new OrdersService(repo, config) };
  }
  const query = (props: Partial<StaffOrderQueryDto>) =>
    Object.assign(new StaffOrderQueryDto(), props);

  it('khoảng ngày theo giờ Việt Nam, gồm cả ngày `to`', async () => {
    const { service, repo } = setup();
    await service.listForStaff(query({ from: '2026-10-01', to: '2026-10-30' }));
    expect(repo.listForStaff.mock.calls[0][0].filter).toMatchObject({
      placedFrom: new Date('2026-09-30T17:00:00Z'),
      placedBefore: new Date('2026-10-30T17:00:00Z'),
    });
  });

  it('from sau to => 400', async () => {
    const { service } = setup();
    await expect(
      service.listForStaff(query({ from: '2026-10-30', to: '2026-10-01' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('sort=oldest => cũ nhất trước; mặc định mới nhất trước', async () => {
    const { service, repo } = setup();
    await service.listForStaff(query({ sort: 'oldest' }));
    await service.listForStaff(query({}));
    expect(repo.listForStaff.mock.calls.map(([p]) => p.oldestFirst)).toEqual([
      true,
      false,
    ]);
  });
});

describe('OrdersService.getDetail', () => {
  type Person = { id: string; fullName: string; role: Role };
  const staffMember: Person = {
    id: 's1',
    fullName: 'Kho Hà Nội',
    role: Role.WAREHOUSE,
  };
  const customerUser: Person = {
    id: 'u1',
    fullName: 'Khách',
    role: Role.CUSTOMER,
  };

  function detail(): OrderDetail {
    const base = savedOrder({
      code: 'SF-261030-AAAA',
      userId: 'u1',
      ...dto,
      shippingFee: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(300),
      items: [
        {
          productId: 'p1',
          productName: 'SP 1',
          unitPrice: new Prisma.Decimal(100),
          quantity: 3,
        },
      ],
    });
    const at = new Date();
    const history = (
      fromStatus: OrderStatus | null,
      toStatus: OrderStatus,
      changedBy: Person | null,
    ) => ({
      id: `h-${toStatus}`,
      orderId: 'o1',
      fromStatus,
      toStatus,
      changedById: changedBy?.id ?? null,
      changedBy,
      note: null,
      createdAt: at,
    });
    return {
      ...base,
      status: OrderStatus.CANCELLED,
      items: base.items.map((item) => ({ ...item, product: { slug: 'sp-1' } })),
      user: { id: 'u1', fullName: 'Nguyễn Văn An', email: 'an@shopfast.vn' },
      statusHistory: [
        history(null, OrderStatus.PENDING_PAYMENT, customerUser),
        history(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID, customerUser),
        history(OrderStatus.PAID, OrderStatus.CONFIRMED, staffMember),
        history(OrderStatus.CONFIRMED, OrderStatus.CANCELLED, null),
      ],
    };
  }

  function setup(found: OrderDetail | null) {
    const repo = {
      findDetail: jest.fn().mockResolvedValue(found),
    } as unknown as jest.Mocked<OrdersRepository>;
    return { repo, service: new OrdersService(repo, config) };
  }

  it('khách => chỉ tìm trong đơn của mình', async () => {
    const { service, repo } = setup(detail());
    await service.getDetail(
      { id: 'u1', email: 'a@b.c', role: Role.CUSTOMER },
      'o1',
    );
    expect(repo.findDetail).toHaveBeenCalledWith('o1', 'u1');
  });

  it('nhân viên => tìm mọi đơn', async () => {
    const { service, repo } = setup(detail());
    await service.getDetail(
      { id: 's1', email: 'k@b.c', role: Role.WAREHOUSE },
      'o1',
    );
    expect(repo.findDetail).toHaveBeenCalledWith('o1', undefined);
  });

  it('không thấy => 404', async () => {
    const { service } = setup(null);
    await expect(
      service.getDetail(
        { id: 'u1', email: 'a@b.c', role: Role.CUSTOMER },
        'o1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('khách => timeline có loại người đổi nhưng KHÔNG có danh tính nhân viên', async () => {
    const { service } = setup(detail());
    const order = await service.getDetail(
      { id: 'u1', email: 'a@b.c', role: Role.CUSTOMER },
      'o1',
    );
    expect(order.timeline.map((t) => t.actor)).toEqual([
      'CUSTOMER',
      'CUSTOMER',
      'STAFF',
      'SYSTEM',
    ]);
    expect(order.timeline.every((t) => !('changedBy' in t))).toBe(true);
    expect(order).not.toHaveProperty('customer');
    expect(order.items[0]).toMatchObject({
      productSlug: 'sp-1',
      lineTotal: 300,
    });
    expect(order).toMatchObject({
      canPay: false,
      canCancel: false,
      paymentDueAt: null,
    });
  });

  it('nhân viên => timeline kèm người đổi', async () => {
    const { service } = setup(detail());
    const order = await service.getDetail(
      { id: 's1', email: 'k@b.c', role: Role.WAREHOUSE },
      'o1',
    );
    expect(order.timeline[2].changedBy).toEqual(staffMember);
    expect(order.customer).toEqual({
      id: 'u1',
      fullName: 'Nguyễn Văn An',
      email: 'an@shopfast.vn',
    });
    expect(order.timeline[3].changedBy).toBeNull();
  });
});

describe('OrdersService.listMine', () => {
  it('trả tóm tắt đơn: tối đa 3 dòng xem trước, tổng loại và tổng số lượng, kèm phân trang', async () => {
    const order = savedOrder({
      code: 'SF-261030-AAAA',
      userId: 'u1',
      ...dto,
      shippingFee: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(1000),
      items: ['a', 'b', 'c', 'd'].map((id, i) => ({
        productId: id,
        productName: `SP ${id}`,
        unitPrice: new Prisma.Decimal(100),
        quantity: i + 1,
      })),
    });
    const repo = {
      listByUser: jest.fn().mockResolvedValue([[order], 21]),
    } as unknown as jest.Mocked<OrdersRepository>;
    const service = new OrdersService(repo, config);
    const query = Object.assign(new OrderQueryDto(), {
      page: 2,
      limit: 20,
      status: [OrderStatus.PENDING_PAYMENT],
    });

    const result = await service.listMine('u1', query);

    expect(repo.listByUser).toHaveBeenCalledWith({
      userId: 'u1',
      statuses: [OrderStatus.PENDING_PAYMENT],
      skip: 20,
      take: 20,
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 21,
      totalPages: 2,
    });
    expect(result.items[0]).toMatchObject({
      itemCount: 4,
      totalQuantity: 10,
      canPay: true,
      canCancel: true,
    });
    expect(result.items[0].previewItems.map((i) => i.productId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(result.items[0].paymentDueAt).toBeInstanceOf(Date);
  });
});

describe('OrdersService.expireOverdueOrders', () => {
  function setup(ids: string[], statuses: Record<string, OrderStatus>) {
    const cancels: Array<[string, string | null, string | null]> = [];
    const repo = {
      findOverdueIds: jest.fn().mockResolvedValue(ids),
      withLockedOrder: jest.fn((id: string, _userId, work) =>
        work({
          status: statuses[id],
          paidAt: null,
          cancel: jest.fn(async (by: string | null, note: string | null) => {
            cancels.push([id, by, note]);
          }),
          changeStatus: jest.fn(),
        }),
      ),
    } as unknown as jest.Mocked<OrdersRepository>;
    return { repo, cancels, service: new OrdersService(repo, config) };
  }

  it('huỷ các đơn quá hạn với người đổi = hệ thống (null), bỏ qua đơn vừa đổi trạng thái', async () => {
    const { service, cancels } = setup(['a', 'b', 'c'], {
      a: OrderStatus.PENDING_PAYMENT,
      b: OrderStatus.CANCELLED,
      c: OrderStatus.PENDING_PAYMENT,
    });

    expect(await service.expireOverdueOrders()).toBe(2);
    expect(cancels).toEqual([
      ['a', null, 'Tự huỷ do quá hạn thanh toán'],
      ['c', null, 'Tự huỷ do quá hạn thanh toán'],
    ]);
  });

  it('chỉ lấy đơn đặt trước mốc hạn thanh toán, tối đa 100 đơn mỗi lượt', async () => {
    const { service, repo } = setup([], {});
    const before = Date.now();
    await service.expireOverdueOrders();

    const [placedBefore, take] = repo.findOverdueIds.mock.calls[0];
    expect(take).toBe(100);
    expect(placedBefore.getTime()).toBeGreaterThanOrEqual(
      before - TIMEOUT_MINUTES * 60_000,
    );
    expect(placedBefore.getTime()).toBeLessThanOrEqual(
      Date.now() - TIMEOUT_MINUTES * 60_000,
    );
  });
});

describe('OrdersService.stats', () => {
  it('đủ 7 trạng thái, trạng thái không có đơn => 0', async () => {
    const repo = {
      countByStatus: jest.fn().mockResolvedValue([
        { status: OrderStatus.PAID, count: 3 },
        { status: OrderStatus.DELIVERED, count: 10 },
      ]),
    } as unknown as jest.Mocked<OrdersRepository>;
    const { counts } = await new OrdersService(repo, config).stats();
    expect(counts).toEqual({
      PENDING_PAYMENT: 0,
      PAID: 3,
      CONFIRMED: 0,
      PACKING: 0,
      SHIPPING: 0,
      DELIVERED: 10,
      CANCELLED: 0,
    });
  });
});
