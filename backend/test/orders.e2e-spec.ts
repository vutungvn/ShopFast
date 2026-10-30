import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { OrderStatus, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Env } from '../src/config/env.validation';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import * as orderCode from '../src/modules/orders/order-code';

// Cần hạ tầng đang chạy: docker compose up -d
// Dữ liệu test mang tiền tố RUN (slug, email) / RUN viết hoa (SKU) và bị xoá sau khi chạy.
const RUN = `e2eorder${Date.now().toString(36)}`;
const SKU = RUN.toUpperCase();
const PASSWORD = 'MatKhau123';
const API = '/api/v1';

const SHIPPING = {
  recipientName: 'Nguyễn Văn An',
  recipientPhone: '0912345678',
  shippingAddress: '12 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
};

type OrderBody = {
  id: string;
  code: string;
  status: string;
  items: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
};

type ConflictBody = {
  message: string;
  items?: Array<{ productId: string; issue: string; stock: number }>;
};

describe('Orders – đặt đơn (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let categoryId: string;
  let brandId: string;
  const emails: string[] = [];
  let productSeq = 0;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function loginAs(role: Role) {
    const email = `${RUN}-${role.toLowerCase()}-${emails.length}@e2e.test`;
    emails.push(email);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hash(PASSWORD, 10),
        fullName: role,
        role,
      },
    });
    const res = await http
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);
    return { id: user.id, token: res.body.accessToken as string };
  }
  const customer = () => loginAs(Role.CUSTOMER);

  /** Mỗi test tạo sản phẩm riêng để tồn kho không ảnh hưởng nhau */
  async function createProduct(price: number, stock: number, isActive = true) {
    const key = `P${++productSeq}`;
    const created = await prisma.product.create({
      data: {
        sku: `${SKU}-${key}`,
        name: `${RUN} ${key}`,
        slug: `${RUN}-${key.toLowerCase()}`,
        price,
        isActive,
        categoryId,
        brandId,
        inventory: { create: { stock } },
      },
    });
    return created.id;
  }

  const stockOf = async (productId: string) =>
    (await prisma.inventory.findUniqueOrThrow({ where: { productId } })).stock;
  const setStock = (productId: string, stock: number) =>
    prisma.inventory.update({ where: { productId }, data: { stock } });
  const cartLines = (userId: string) =>
    prisma.cartItem.findMany({
      where: { cart: { userId } },
      select: { productId: true, quantity: true },
    });
  const orderCount = (userId: string) =>
    prisma.order.count({ where: { userId } });

  const addToCart = (token: string, productId: string, quantity: number) =>
    http
      .post(`${API}/cart/items`)
      .set(bearer(token))
      .send({ productId, quantity })
      .expect(200);
  const placeOrder = (token: string, body: object = SHIPPING) =>
    http.post(`${API}/orders`).set(bearer(token)).send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());

    categoryId = (
      await prisma.category.create({
        data: { name: `${RUN} Điện thoại`, slug: `${RUN}-dien-thoai` },
      })
    ).id;
    brandId = (
      await prisma.brand.create({
        data: { name: `${RUN} Apple`, slug: `${RUN}-apple` },
      })
    ).id;
  });

  afterAll(async () => {
    // Đơn tham chiếu user và sản phẩm (không cascade) nên xoá trước; lịch sử, dòng đơn xoá theo đơn
    await prisma.order.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU } } });
    await prisma.category.deleteMany({ where: { slug: { startsWith: RUN } } });
    await prisma.brand.deleteMany({ where: { slug: { startsWith: RUN } } });
    await app.close();
  });

  describe('Phân quyền và dữ liệu vào', () => {
    it('TC01 chưa đăng nhập => 401', async () => {
      await http.post(`${API}/orders`).send(SHIPPING).expect(401);
    });

    it.each([Role.WAREHOUSE, Role.SUPPORT, Role.ADMIN])(
      'TC02 %s không đặt được đơn => 403',
      async (role) => {
        const staff = await loginAs(role);
        await placeOrder(staff.token).expect(403);
      },
    );

    it.each([
      ['thiếu tên người nhận', { ...SHIPPING, recipientName: undefined }],
      ['tên chỉ có khoảng trắng', { ...SHIPPING, recipientName: '   ' }],
      ['số điện thoại sai', { ...SHIPPING, recipientPhone: '12345' }],
      ['địa chỉ quá ngắn', { ...SHIPPING, shippingAddress: 'Hà Nội' }],
      ['gửi thừa trường', { ...SHIPPING, totalAmount: 1 }],
    ])('TC03 %s => 400, giỏ và kho giữ nguyên', async (_case, body) => {
      const c = await customer();
      const p = await createProduct(100_000, 5);
      await addToCart(c.token, p, 1);

      await placeOrder(c.token, body).expect(400);

      expect(await stockOf(p)).toBe(5);
      expect(await cartLines(c.id)).toHaveLength(1);
    });
  });

  describe('Đặt đơn thành công', () => {
    it('TC04 giỏ 2 sản phẩm => 201, trừ kho, lưu dòng đơn, ghi lịch sử, xoá giỏ', async () => {
      const c = await customer();
      const phone = await createProduct(22_990_000, 10);
      const case_ = await createProduct(150_000, 5);
      await addToCart(c.token, phone, 2);
      await addToCart(c.token, case_, 3);

      const res = await placeOrder(c.token).expect(201);
      const body = res.body as OrderBody;

      expect(body).toMatchObject({
        status: 'PENDING_PAYMENT',
        ...SHIPPING,
        subtotal: 46_430_000,
        shippingFee: 0,
        totalAmount: 46_430_000,
        paidAt: null,
        cancelledAt: null,
      });
      expect(body.code).toMatch(/^SF-\d{6}-[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{4}$/);
      expect(body.items).toHaveLength(2);
      expect(body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId: phone,
            unitPrice: 22_990_000,
            quantity: 2,
            lineTotal: 45_980_000,
          }),
          expect.objectContaining({
            productId: case_,
            unitPrice: 150_000,
            quantity: 3,
            lineTotal: 450_000,
          }),
        ]),
      );

      expect(await stockOf(phone)).toBe(8);
      expect(await stockOf(case_)).toBe(2);
      expect(await cartLines(c.id)).toEqual([]);
      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId: body.id },
      });
      expect(history).toEqual([
        expect.objectContaining({
          fromStatus: null,
          toStatus: 'PENDING_PAYMENT',
          changedById: c.id,
        }),
      ]);
    });

    it('TC05 giá đổi sau khi thêm vào giỏ => đơn lấy giá mới; đổi giá sau khi đặt thì đơn giữ giá cũ', async () => {
      const c = await customer();
      const p = await createProduct(1_000_000, 10);
      await addToCart(c.token, p, 2);
      await prisma.product.update({
        where: { id: p },
        data: { price: 900_000 },
      });

      const res = await placeOrder(c.token).expect(201);
      expect(res.body.items[0].unitPrice).toBe(900_000);
      expect(res.body.totalAmount).toBe(1_800_000);

      await prisma.product.update({
        where: { id: p },
        data: { price: 2_000_000 },
      });
      const item = await prisma.orderItem.findFirstOrThrow({
        where: { orderId: res.body.id },
      });
      expect(item.unitPrice.toNumber()).toBe(900_000);
    });
  });

  describe('Không đặt được', () => {
    it('TC06 giỏ trống (chưa từng có giỏ, hoặc vừa đặt xong) => 409 "Giỏ hàng trống"', async () => {
      const fresh = await customer();
      const r1 = await placeOrder(fresh.token).expect(409);
      expect(r1.body.message).toBe('Giỏ hàng trống');
      // Không tạo giỏ chỉ vì gọi đặt đơn
      expect(await prisma.cart.count({ where: { userId: fresh.id } })).toBe(0);

      const c = await customer();
      await addToCart(c.token, await createProduct(100_000, 5), 1);
      await placeOrder(c.token).expect(201);
      const r2 = await placeOrder(c.token).expect(409);
      expect(r2.body.message).toBe('Giỏ hàng trống');
      expect(await orderCount(c.id)).toBe(1);
    });

    it('TC07 có sản phẩm ngừng bán => 409 kèm danh sách; kho sản phẩm còn lại KHÔNG bị trừ, giỏ giữ nguyên', async () => {
      const c = await customer();
      const ok = await createProduct(100_000, 10);
      const off = await createProduct(200_000, 10);
      await addToCart(c.token, ok, 2);
      await addToCart(c.token, off, 1);
      await prisma.product.update({
        where: { id: off },
        data: { isActive: false },
      });

      const res = await placeOrder(c.token).expect(409);
      const body = res.body as ConflictBody;

      expect(body.items).toEqual([
        expect.objectContaining({ productId: off, issue: 'INACTIVE' }),
      ]);
      expect(body.message).toContain('ngừng bán');
      expect(await stockOf(ok)).toBe(10);
      expect(await cartLines(c.id)).toHaveLength(2);
      expect(await orderCount(c.id)).toBe(0);
    });

    it('TC08 kho giảm dưới số lượng trong giỏ => 409 INSUFFICIENT_STOCK kèm tồn kho; dòng đã trừ được hoàn lại', async () => {
      const c = await customer();
      const ok = await createProduct(100_000, 10);
      const low = await createProduct(200_000, 10);
      await addToCart(c.token, ok, 3);
      await addToCart(c.token, low, 5);
      await setStock(low, 2);

      const res = await placeOrder(c.token).expect(409);
      const body = res.body as ConflictBody;

      expect(body.items).toEqual([
        expect.objectContaining({
          productId: low,
          issue: 'INSUFFICIENT_STOCK',
          stock: 2,
        }),
      ]);
      expect(body.message).toContain('còn 2');
      // Dù sản phẩm "ok" có thể đã được trừ trước khi gặp dòng lỗi, transaction phải hoàn lại
      expect(await stockOf(ok)).toBe(10);
      expect(await stockOf(low)).toBe(2);
      expect(await cartLines(c.id)).toHaveLength(2);
    });

    it('TC09 hết hàng => 409 OUT_OF_STOCK', async () => {
      const c = await customer();
      const p = await createProduct(100_000, 3);
      await addToCart(c.token, p, 1);
      await setStock(p, 0);

      const res = await placeOrder(c.token).expect(409);
      expect((res.body as ConflictBody).items).toEqual([
        expect.objectContaining({
          productId: p,
          issue: 'OUT_OF_STOCK',
          stock: 0,
        }),
      ]);
    });
  });

  describe('Đồng thời', () => {
    it('TC10 hai khách cùng lúc mua MÓN CUỐI CÙNG => đúng 1 đơn thành công, kho = 0 (lặp 5 vòng)', async () => {
      for (let round = 0; round < 5; round++) {
        const a = await customer();
        const b = await customer();
        const p = await createProduct(5_000_000, 1);
        await addToCart(a.token, p, 1);
        await addToCart(b.token, p, 1);

        const statuses = (
          await Promise.all([placeOrder(a.token), placeOrder(b.token)])
        ).map((r) => r.status);

        expect(statuses.sort()).toEqual([201, 409]);
        expect(await stockOf(p)).toBe(0);
        expect(
          await prisma.orderItem.aggregate({
            where: { productId: p },
            _sum: { quantity: true },
          }),
        ).toEqual({ _sum: { quantity: 1 } });
      }
    });

    it('TC11 10 khách cùng lúc tranh 3 món => đúng 3 đơn, kho không âm', async () => {
      const p = await createProduct(1_000_000, 3);
      const buyers = await Promise.all(Array.from({ length: 10 }, customer));
      for (const buyer of buyers) await addToCart(buyer.token, p, 1);

      const statuses = (
        await Promise.all(buyers.map((buyer) => placeOrder(buyer.token)))
      ).map((r) => r.status);

      expect(statuses.filter((s) => s === 201)).toHaveLength(3);
      expect(statuses.filter((s) => s === 409)).toHaveLength(7);
      expect(await stockOf(p)).toBe(0);
    });

    it('TC12 một khách bấm đặt 2 lần cùng lúc => chỉ 1 đơn, lần sau 409 "Giỏ hàng trống"', async () => {
      const c = await customer();
      const p = await createProduct(100_000, 10);
      await addToCart(c.token, p, 2);

      const [r1, r2] = await Promise.all([
        placeOrder(c.token),
        placeOrder(c.token),
      ]);

      expect([r1.status, r2.status].sort()).toEqual([201, 409]);
      expect((r1.status === 409 ? r1 : r2).body.message).toBe('Giỏ hàng trống');
      expect(await orderCount(c.id)).toBe(1);
      expect(await stockOf(p)).toBe(8);
    });

    it('TC13 nhiều khách cùng mua chung 2 sản phẩm cùng lúc, kho đủ => tất cả thành công, không deadlock', async () => {
      const x = await createProduct(100_000, 100);
      const y = await createProduct(200_000, 100);
      const buyers = await Promise.all(Array.from({ length: 6 }, customer));
      // Nửa thêm X trước, nửa thêm Y trước
      for (const [i, buyer] of buyers.entries()) {
        const [first, second] = i % 2 ? [x, y] : [y, x];
        await addToCart(buyer.token, first, 1);
        await addToCart(buyer.token, second, 1);
      }

      const statuses = (
        await Promise.all(buyers.map((buyer) => placeOrder(buyer.token)))
      ).map((r) => r.status);

      expect(statuses).toEqual(Array(6).fill(201));
      expect(await stockOf(x)).toBe(94);
      expect(await stockOf(y)).toBe(94);
    });

    it('TC14 đặt đơn trong lúc thêm vào giỏ => chạy lần lượt: món mới nằm trong đơn HOẶC còn trong giỏ, không mất', async () => {
      const c = await customer();
      const a = await createProduct(100_000, 10);
      const b = await createProduct(100_000, 10);
      await addToCart(c.token, a, 1);

      const [order] = await Promise.all([
        placeOrder(c.token).expect(201),
        http
          .post(`${API}/cart/items`)
          .set(bearer(c.token))
          .send({ productId: b, quantity: 1 })
          .expect(200),
      ]);

      const inOrder = (order.body as OrderBody).items.some(
        (i) => i.productId === b,
      );
      const inCart = (await cartLines(c.id)).some((l) => l.productId === b);
      expect(inOrder !== inCart).toBe(true);
      expect(await stockOf(b)).toBe(inOrder ? 9 : 10);
    });
  });

  it('TC15 mã đơn sinh ra bị trùng => tự tạo mã khác, đơn vẫn thành công', async () => {
    const c = await customer();
    await addToCart(c.token, await createProduct(100_000, 10), 1);
    const first = await placeOrder(c.token).expect(201);
    const takenCode = (first.body as OrderBody).code;

    await addToCart(c.token, await createProduct(100_000, 10), 1);
    const spy = jest
      .spyOn(orderCode, 'generateOrderCode')
      .mockReturnValueOnce(takenCode);
    try {
      const second = await placeOrder(c.token).expect(201);
      expect(second.body.code).not.toBe(takenCode);
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  describe('Thanh toán (giả lập)', () => {
    const pay = (token: string, orderId: string) =>
      http.post(`${API}/orders/${orderId}/pay`).set(bearer(token));

    /** Khách mới + một đơn PENDING_PAYMENT của khách đó */
    async function pendingOrder() {
      const c = await customer();
      const p = await createProduct(500_000, 10);
      await addToCart(c.token, p, 2);
      const res = await placeOrder(c.token).expect(201);
      return { ...c, productId: p, orderId: (res.body as OrderBody).id };
    }
    const historyOf = (orderId: string) =>
      prisma.orderStatusHistory.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });

    it('TC16 thanh toán đơn của mình => 200 PAID, có paidAt, ghi lịch sử; tồn kho không đổi', async () => {
      const o = await pendingOrder();

      const res = await pay(o.token, o.orderId).expect(200);

      expect(res.body).toMatchObject({
        id: o.orderId,
        status: 'PAID',
        totalAmount: 1_000_000,
      });
      expect(res.body.paidAt).not.toBeNull();
      expect(await stockOf(o.productId)).toBe(8);
      expect(await historyOf(o.orderId)).toEqual([
        expect.objectContaining({ toStatus: 'PENDING_PAYMENT' }),
        expect.objectContaining({
          fromStatus: 'PENDING_PAYMENT',
          toStatus: 'PAID',
          changedById: o.id,
          note: 'Thanh toán (giả lập)',
        }),
      ]);
    });

    it('TC17 thanh toán lần 2 => 409 "đã được thanh toán", không thêm lịch sử', async () => {
      const o = await pendingOrder();
      await pay(o.token, o.orderId).expect(200);

      const res = await pay(o.token, o.orderId).expect(409);

      expect(res.body.message).toBe('Đơn hàng đã được thanh toán');
      expect(await historyOf(o.orderId)).toHaveLength(2);
    });

    it('TC18 bấm thanh toán 2 lần cùng lúc => đúng 1 lần thành công, 1 dòng lịch sử PAID', async () => {
      const o = await pendingOrder();

      const statuses = (
        await Promise.all([pay(o.token, o.orderId), pay(o.token, o.orderId)])
      ).map((r) => r.status);

      expect(statuses.sort()).toEqual([200, 409]);
      const paidRows = (await historyOf(o.orderId)).filter(
        (h) => h.toStatus === 'PAID',
      );
      expect(paidRows).toHaveLength(1);
    });

    it('TC19 đơn của khách khác hoặc không tồn tại => 404; id sai định dạng => 400', async () => {
      const o = await pendingOrder();
      const other = await customer();

      await pay(other.token, o.orderId).expect(404);
      await pay(o.token, '00000000-0000-4000-8000-000000000000').expect(404);
      await pay(o.token, 'abc').expect(400);
      // Khách khác thử thanh toán không làm đổi đơn
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: o.orderId },
      });
      expect(order.status).toBe('PENDING_PAYMENT');
    });

    it('TC20 đơn đã huỷ => 409 "đã bị huỷ"', async () => {
      const o = await pendingOrder();
      await prisma.order.update({
        where: { id: o.orderId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      const res = await pay(o.token, o.orderId).expect(409);
      expect(res.body.message).toBe('Đơn hàng đã bị huỷ');
    });

    it('TC21 đơn quá hạn thanh toán => 409, đơn vẫn PENDING_PAYMENT', async () => {
      const o = await pendingOrder();
      const timeout = app
        .get(ConfigService<Env, true>)
        .get('ORDER_PAYMENT_TIMEOUT_MINUTES', { infer: true });
      await prisma.order.update({
        where: { id: o.orderId },
        data: { createdAt: new Date(Date.now() - (timeout + 1) * 60_000) },
      });

      const res = await pay(o.token, o.orderId).expect(409);

      expect(res.body.message).toBe('Đơn đã quá hạn thanh toán');
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: o.orderId },
      });
      expect(order).toMatchObject({ status: 'PENDING_PAYMENT', paidAt: null });
    });

    it('TC22 chưa đăng nhập => 401; nhân viên => 403', async () => {
      const o = await pendingOrder();
      await http.post(`${API}/orders/${o.orderId}/pay`).expect(401);
      for (const role of [Role.WAREHOUSE, Role.SUPPORT, Role.ADMIN]) {
        const staff = await loginAs(role);
        await pay(staff.token, o.orderId).expect(403);
      }
    });
  });

  describe('Khách huỷ đơn', () => {
    const cancel = (token: string, orderId: string, body: object = {}) =>
      http
        .post(`${API}/orders/${orderId}/cancel`)
        .set(bearer(token))
        .send(body);
    const pay = (token: string, orderId: string) =>
      http.post(`${API}/orders/${orderId}/pay`).set(bearer(token));

    /** Khách mới đặt 3 món của một sản phẩm tồn kho 10 => sau khi đặt kho còn 7 */
    async function placedOrder() {
      const c = await customer();
      const p = await createProduct(300_000, 10);
      await addToCart(c.token, p, 3);
      const res = await placeOrder(c.token).expect(201);
      return { ...c, productId: p, orderId: (res.body as OrderBody).id };
    }
    const lastHistory = (orderId: string) =>
      prisma.orderStatusHistory.findFirstOrThrow({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
      });
    const setStatus = (orderId: string, status: OrderStatus) =>
      prisma.order.update({ where: { id: orderId }, data: { status } });

    it('TC23 huỷ đơn chờ thanh toán => 200 CANCELLED, trả đủ kho, ghi lịch sử kèm lý do', async () => {
      const o = await placedOrder();
      expect(await stockOf(o.productId)).toBe(7);

      const res = await cancel(o.token, o.orderId, {
        reason: '  Đặt nhầm màu  ',
      }).expect(200);

      expect(res.body).toMatchObject({ id: o.orderId, status: 'CANCELLED' });
      expect(res.body.cancelledAt).not.toBeNull();
      expect(await stockOf(o.productId)).toBe(10);
      expect(await lastHistory(o.orderId)).toMatchObject({
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'CANCELLED',
        changedById: o.id,
        note: 'Đặt nhầm màu',
      });
    });

    it('TC24 huỷ đơn đã thanh toán => 200, ghi chú hoàn tiền giả lập; không gửi body vẫn được', async () => {
      const o = await placedOrder();
      await pay(o.token, o.orderId).expect(200);

      await http
        .post(`${API}/orders/${o.orderId}/cancel`)
        .set(bearer(o.token))
        .expect(200);

      expect(await stockOf(o.productId)).toBe(10);
      expect(await lastHistory(o.orderId)).toMatchObject({
        fromStatus: 'PAID',
        toStatus: 'CANCELLED',
        note: 'Hoàn tiền (giả lập)',
      });
    });

    it('TC25 huỷ lần 2 => 409 "đã bị huỷ", kho không cộng thêm', async () => {
      const o = await placedOrder();
      await cancel(o.token, o.orderId).expect(200);

      const res = await cancel(o.token, o.orderId).expect(409);

      expect(res.body.message).toBe('Đơn hàng đã bị huỷ');
      expect(await stockOf(o.productId)).toBe(10);
    });

    it('TC26 bấm huỷ 2 lần cùng lúc => 1 thành công, kho chỉ cộng 1 lần (lặp 5 vòng)', async () => {
      for (let round = 0; round < 5; round++) {
        const o = await placedOrder();
        const statuses = (
          await Promise.all([
            cancel(o.token, o.orderId),
            cancel(o.token, o.orderId),
          ])
        ).map((r) => r.status);

        expect(statuses.sort()).toEqual([200, 409]);
        expect(await stockOf(o.productId)).toBe(10);
      }
    });

    it('TC27 huỷ cùng lúc thanh toán => đơn luôn kết thúc CANCELLED, kho trả đúng 1 lần (lặp 5 vòng)', async () => {
      for (let round = 0; round < 5; round++) {
        const o = await placedOrder();
        const [payRes, cancelRes] = await Promise.all([
          pay(o.token, o.orderId),
          cancel(o.token, o.orderId),
        ]);

        // PAID vẫn huỷ được nên huỷ luôn thành công; thanh toán thắng hay thua tuỳ ai tới trước
        expect(cancelRes.status).toBe(200);
        expect([200, 409]).toContain(payRes.status);
        const order = await prisma.order.findUniqueOrThrow({
          where: { id: o.orderId },
        });
        expect(order.status).toBe('CANCELLED');
        expect(await stockOf(o.productId)).toBe(10);
      }
    });

    it.each([
      OrderStatus.CONFIRMED,
      OrderStatus.PACKING,
      OrderStatus.SHIPPING,
      OrderStatus.DELIVERED,
    ])(
      'TC28 đơn đang %s => 409 "đã được xử lý", kho giữ nguyên',
      async (status) => {
        const o = await placedOrder();
        await setStatus(o.orderId, status);

        const res = await cancel(o.token, o.orderId).expect(409);

        expect(res.body.message).toBe('Đơn hàng đã được xử lý, không thể huỷ');
        expect(await stockOf(o.productId)).toBe(7);
      },
    );

    it('TC29 đơn của khách khác => 404; lý do quá 500 ký tự => 400; id sai => 400', async () => {
      const o = await placedOrder();
      const other = await customer();

      await cancel(other.token, o.orderId).expect(404);
      await cancel(o.token, o.orderId, { reason: 'x'.repeat(501) }).expect(400);
      await cancel(o.token, 'abc').expect(400);
      expect(await stockOf(o.productId)).toBe(7);
    });

    it('TC30 sản phẩm đã ngừng bán => vẫn được trả kho', async () => {
      const o = await placedOrder();
      await prisma.product.update({
        where: { id: o.productId },
        data: { isActive: false },
      });

      await cancel(o.token, o.orderId).expect(200);

      expect(await stockOf(o.productId)).toBe(10);
    });

    it('TC31 chưa đăng nhập => 401; CSKH => 403; kho/admin không ghi lý do => 400', async () => {
      const o = await placedOrder();
      await http.post(`${API}/orders/${o.orderId}/cancel`).expect(401);
      const support = await loginAs(Role.SUPPORT);
      await cancel(support.token, o.orderId, {
        reason: 'Khách nhờ huỷ',
      }).expect(403);
      for (const role of [Role.WAREHOUSE, Role.ADMIN]) {
        const staff = await loginAs(role);
        await cancel(staff.token, o.orderId).expect(400);
      }
      expect(await stockOf(o.productId)).toBe(7);
    });
  });

  describe('Lịch sử đơn của khách', () => {
    const listMine = (token: string, query = '') =>
      http.get(`${API}/orders/me${query}`).set(bearer(token));
    const getDetail = (token: string, orderId: string) =>
      http.get(`${API}/orders/${orderId}`).set(bearer(token));
    const pay = (token: string, orderId: string) =>
      http.post(`${API}/orders/${orderId}/pay`).set(bearer(token));
    const cancel = (token: string, orderId: string) =>
      http.post(`${API}/orders/${orderId}/cancel`).set(bearer(token)).send({});

    /** Đặt một đơn cho khách `c` với các sản phẩm mới tạo, mỗi sản phẩm `quantity` món */
    async function order(
      c: { token: string },
      products: Array<{ price: number; quantity: number }> = [
        { price: 100_000, quantity: 1 },
      ],
    ) {
      for (const p of products) {
        await addToCart(c.token, await createProduct(p.price, 50), p.quantity);
      }
      const res = await placeOrder(c.token).expect(201);
      return (res.body as OrderBody).id;
    }

    it('TC32 danh sách: chỉ đơn của mình, mới nhất trước, phân trang đúng', async () => {
      const c = await customer();
      const other = await customer();
      const ids = [await order(c), await order(c), await order(c)];
      await order(other);

      const all = await listMine(c.token).expect(200);
      expect(all.body.items.map((o: { id: string }) => o.id)).toEqual(
        [...ids].reverse(),
      );
      expect(all.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });

      const page2 = await listMine(c.token, '?limit=2&page=2').expect(200);
      expect(page2.body.items.map((o: { id: string }) => o.id)).toEqual([
        ids[0],
      ]);
      expect(page2.body.meta).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('TC33 lọc nhiều trạng thái; trạng thái lạ => 400', async () => {
      const c = await customer();
      const pending = await order(c);
      const paid = await order(c);
      const cancelled = await order(c);
      await pay(c.token, paid).expect(200);
      await cancel(c.token, cancelled).expect(200);

      const res = await listMine(c.token, '?status=PAID,CANCELLED').expect(200);
      const found = res.body.items.map((o: { id: string }) => o.id).sort();
      expect(found).toEqual([paid, cancelled].sort());
      expect(found).not.toContain(pending);

      await listMine(c.token, '?status=SHIPPED').expect(400);
      await listMine(c.token, '?limit=101').expect(400);
    });

    it('TC34 thẻ đơn: tối đa 3 dòng xem trước, đúng tổng loại và tổng số lượng, hạn thanh toán', async () => {
      const c = await customer();
      await order(c, [
        { price: 100_000, quantity: 1 },
        { price: 200_000, quantity: 2 },
        { price: 300_000, quantity: 3 },
        { price: 400_000, quantity: 4 },
      ]);

      const [summary] = (await listMine(c.token).expect(200)).body.items;

      expect(summary).toMatchObject({
        status: 'PENDING_PAYMENT',
        totalAmount: 3_000_000,
        itemCount: 4,
        totalQuantity: 10,
        canPay: true,
        canCancel: true,
      });
      expect(summary.previewItems).toHaveLength(3);
      expect(summary.code).toMatch(/^SF-/);
      expect(new Date(summary.paymentDueAt).getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    it('TC35 chi tiết: giá lúc đặt, slug sản phẩm, timeline đúng thứ tự, khách không thấy danh tính người đổi', async () => {
      const c = await customer();
      const orderId = await order(c, [{ price: 500_000, quantity: 2 }]);
      const productId = (
        await prisma.orderItem.findFirstOrThrow({ where: { orderId } })
      ).productId;
      await prisma.product.update({
        where: { id: productId },
        data: { price: 999_000 },
      });
      await pay(c.token, orderId).expect(200);
      await cancel(c.token, orderId).expect(200);

      const res = await getDetail(c.token, orderId).expect(200);

      expect(res.body).toMatchObject({
        id: orderId,
        status: 'CANCELLED',
        ...SHIPPING,
        totalAmount: 1_000_000,
        canPay: false,
        canCancel: false,
        paymentDueAt: null,
      });
      expect(res.body.items[0]).toMatchObject({
        productId,
        unitPrice: 500_000,
        lineTotal: 1_000_000,
        productSlug: expect.stringContaining(RUN),
      });
      expect(
        res.body.timeline.map((t: { toStatus: string; actor: string }) => [
          t.toStatus,
          t.actor,
        ]),
      ).toEqual([
        ['PENDING_PAYMENT', 'CUSTOMER'],
        ['PAID', 'CUSTOMER'],
        ['CANCELLED', 'CUSTOMER'],
      ]);
      expect(res.body.timeline[2].note).toBe('Hoàn tiền (giả lập)');
      expect(res.body.timeline.some((t: object) => 'changedBy' in t)).toBe(
        false,
      );
    });

    it('TC36 đơn quá hạn chưa bị huỷ => canPay=false, hạn thanh toán đã qua, vẫn huỷ được', async () => {
      const c = await customer();
      const orderId = await order(c);
      await prisma.order.update({
        where: { id: orderId },
        data: { createdAt: new Date(Date.now() - 30 * 24 * 60 * 60_000) },
      });

      const detail = (await getDetail(c.token, orderId).expect(200)).body;
      const [summary] = (await listMine(c.token).expect(200)).body.items;

      for (const o of [detail, summary]) {
        expect(o).toMatchObject({
          status: 'PENDING_PAYMENT',
          canPay: false,
          canCancel: true,
        });
        expect(new Date(o.paymentDueAt).getTime()).toBeLessThan(Date.now());
      }
    });

    it('TC37 đơn của khách khác => 404; id sai => 400; không có token => 401', async () => {
      const owner = await customer();
      const other = await customer();
      const orderId = await order(owner);

      await getDetail(other.token, orderId).expect(404);
      await getDetail(
        owner.token,
        '00000000-0000-4000-8000-000000000000',
      ).expect(404);
      await getDetail(owner.token, 'abc').expect(400);
      await http.get(`${API}/orders/${orderId}`).expect(401);
      await http.get(`${API}/orders/me`).expect(401);
    });

    it('TC38 nhân viên xem được mọi đơn kèm người đổi trạng thái, nhưng /orders/me => 403', async () => {
      const c = await customer();
      const orderId = await order(c);
      const warehouse = await loginAs(Role.WAREHOUSE);
      // Giả lập kho xác nhận và hệ thống huỷ (chưa có endpoint của kho / job tự huỷ)
      await prisma.orderStatusHistory.createMany({
        data: [
          {
            orderId,
            fromStatus: 'PENDING_PAYMENT',
            toStatus: 'PAID',
            changedById: warehouse.id,
            createdAt: new Date(Date.now() + 1_000),
          },
          {
            orderId,
            fromStatus: 'PAID',
            toStatus: 'CANCELLED',
            changedById: null,
            createdAt: new Date(Date.now() + 2_000),
          },
        ],
      });

      for (const role of [Role.SUPPORT, Role.WAREHOUSE, Role.ADMIN]) {
        const staff = role === Role.WAREHOUSE ? warehouse : await loginAs(role);
        const res = await getDetail(staff.token, orderId).expect(200);
        expect(
          res.body.timeline.map((t: { actor: string }) => t.actor),
        ).toEqual(['CUSTOMER', 'STAFF', 'SYSTEM']);
        expect(res.body.timeline[0].changedBy).toMatchObject({
          id: c.id,
          role: 'CUSTOMER',
        });
        expect(res.body.timeline[1].changedBy).toMatchObject({
          id: warehouse.id,
          role: 'WAREHOUSE',
        });
        expect(res.body.timeline[2].changedBy).toBeNull();
        await listMine(staff.token).expect(403);
      }

      const asCustomer = await getDetail(c.token, orderId).expect(200);
      expect(
        asCustomer.body.timeline.map((t: { actor: string }) => t.actor),
      ).toEqual(['CUSTOMER', 'STAFF', 'SYSTEM']);
      expect(
        asCustomer.body.timeline.some((t: object) => 'changedBy' in t),
      ).toBe(false);
    });
  });

  describe('Kho xử lý đơn', () => {
    const advance = (token: string, orderId: string, body: object) =>
      http
        .patch(`${API}/orders/${orderId}/status`)
        .set(bearer(token))
        .send(body);
    const cancel = (token: string, orderId: string, body: object = {}) =>
      http
        .post(`${API}/orders/${orderId}/cancel`)
        .set(bearer(token))
        .send(body);
    const pay = (token: string, orderId: string) =>
      http.post(`${API}/orders/${orderId}/pay`).set(bearer(token)).expect(200);
    const listStaff = (token: string, query = '') =>
      http.get(`${API}/orders${query}`).set(bearer(token));

    let warehouse: { id: string; token: string };
    beforeAll(async () => {
      warehouse = await loginAs(Role.WAREHOUSE);
    });

    /** Số điện thoại riêng cho mỗi lần gọi để lọc `q` không lẫn dữ liệu test khác */
    let phoneSeq = 0;
    const uniquePhone = () =>
      `09${String(Date.now() % 1e6).padStart(6, '0')}${String(++phoneSeq).padStart(2, '0')}`;

    /** Đơn 2 món của sản phẩm tồn kho 10 (sau khi đặt còn 8); `paid` = đã thanh toán */
    async function newOrder({ paid = true, phone = uniquePhone() } = {}) {
      const c = await customer();
      const p = await createProduct(250_000, 10);
      await addToCart(c.token, p, 2);
      const res = await placeOrder(c.token, {
        ...SHIPPING,
        recipientPhone: phone,
      }).expect(201);
      const orderId = (res.body as OrderBody).id;
      if (paid) await pay(c.token, orderId);
      return {
        customer: c,
        productId: p,
        orderId,
        code: (res.body as OrderBody).code,
        phone,
      };
    }
    const statusOf = async (orderId: string) =>
      (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;
    const historyTo = (orderId: string, toStatus: OrderStatus) =>
      prisma.orderStatusHistory.count({ where: { orderId, toStatus } });

    it('TC39 kho đẩy đơn từng bước tới DELIVERED: ghi người đổi, ghi chú; tồn kho không đổi', async () => {
      const o = await newOrder();

      for (const status of [
        OrderStatus.CONFIRMED,
        OrderStatus.PACKING,
        OrderStatus.SHIPPING,
        OrderStatus.DELIVERED,
      ]) {
        const res = await advance(warehouse.token, o.orderId, {
          status,
          note: `Bước ${status}`,
        }).expect(200);
        expect(res.body.status).toBe(status);
        const last = res.body.timeline.at(-1);
        expect(last).toMatchObject({
          toStatus: status,
          actor: 'STAFF',
          note: `Bước ${status}`,
          changedBy: { id: warehouse.id, role: 'WAREHOUSE' },
        });
      }

      expect(await stockOf(o.productId)).toBe(8);
      // Khách thấy kho đổi trạng thái nhưng không thấy là ai
      const asCustomer = await http
        .get(`${API}/orders/${o.orderId}`)
        .set(bearer(o.customer.token))
        .expect(200);
      expect(
        asCustomer.body.timeline.map((t: { actor: string }) => t.actor),
      ).toEqual(['CUSTOMER', 'CUSTOMER', 'STAFF', 'STAFF', 'STAFF', 'STAFF']);
      expect(
        asCustomer.body.timeline.some((t: object) => 'changedBy' in t),
      ).toBe(false);
    });

    it('TC40 bước không hợp lệ => 409 kèm trạng thái hiện tại; dữ liệu sai => 400; không có đơn => 404', async () => {
      const o = await newOrder();
      const pending = await newOrder({ paid: false });

      const skip = await advance(warehouse.token, o.orderId, {
        status: 'SHIPPING',
      }).expect(409);
      expect(skip.body).toMatchObject({
        message: "Không thể chuyển đơn từ 'Đã thanh toán' sang 'Đang giao'",
        currentStatus: 'PAID',
      });
      await advance(warehouse.token, o.orderId, {
        status: 'PENDING_PAYMENT',
      }).expect(409);
      await advance(warehouse.token, o.orderId, { status: 'CANCELLED' }).expect(
        409,
      );
      await advance(warehouse.token, pending.orderId, {
        status: 'CONFIRMED',
      }).expect(409);

      await advance(warehouse.token, o.orderId, { status: 'DONE' }).expect(400);
      await advance(warehouse.token, o.orderId, {
        status: 'CONFIRMED',
        note: 'x'.repeat(501),
      }).expect(400);
      await advance(warehouse.token, '00000000-0000-4000-8000-000000000000', {
        status: 'CONFIRMED',
      }).expect(404);

      expect(await statusOf(o.orderId)).toBe('PAID');
      expect(await statusOf(pending.orderId)).toBe('PENDING_PAYMENT');
    });

    it('TC41 hai nhân viên cùng xác nhận một đơn => 1 thành công, 1 nhận 409, chỉ 1 dòng lịch sử (lặp 5 vòng)', async () => {
      const other = await loginAs(Role.ADMIN);
      for (let round = 0; round < 5; round++) {
        const o = await newOrder();
        const statuses = (
          await Promise.all([
            advance(warehouse.token, o.orderId, { status: 'CONFIRMED' }),
            advance(other.token, o.orderId, { status: 'CONFIRMED' }),
          ])
        ).map((r) => r.status);

        expect(statuses.sort()).toEqual([200, 409]);
        expect(await statusOf(o.orderId)).toBe('CONFIRMED');
        expect(await historyTo(o.orderId, OrderStatus.CONFIRMED)).toBe(1);
      }
    });

    it('TC42 kho xác nhận cùng lúc khách huỷ => chỉ một bên thắng, kho khớp với bên thắng (lặp 5 vòng)', async () => {
      for (let round = 0; round < 5; round++) {
        const o = await newOrder();
        const [confirmRes, cancelRes] = await Promise.all([
          advance(warehouse.token, o.orderId, { status: 'CONFIRMED' }),
          cancel(o.customer.token, o.orderId),
        ]);

        expect([confirmRes.status, cancelRes.status].sort()).toEqual([
          200, 409,
        ]);
        if (confirmRes.status === 200) {
          expect(cancelRes.body.message).toBe(
            'Đơn hàng đã được xử lý, không thể huỷ',
          );
          expect(await statusOf(o.orderId)).toBe('CONFIRMED');
          expect(await stockOf(o.productId)).toBe(8);
        } else {
          expect(confirmRes.body.currentStatus).toBe('CANCELLED');
          expect(await statusOf(o.orderId)).toBe('CANCELLED');
          expect(await stockOf(o.productId)).toBe(10);
        }
      }
    });

    it('TC43 nhân viên huỷ đơn đang đóng gói (bắt buộc lý do) => trả kho, ghi hoàn tiền; đang giao => 409', async () => {
      const o = await newOrder();
      await advance(warehouse.token, o.orderId, { status: 'CONFIRMED' }).expect(
        200,
      );
      await advance(warehouse.token, o.orderId, { status: 'PACKING' }).expect(
        200,
      );

      await cancel(warehouse.token, o.orderId, { reason: 'abc' }).expect(400);
      await cancel(warehouse.token, o.orderId, {
        reason: '  Không liên lạc được khách  ',
      }).expect(200);

      expect(await stockOf(o.productId)).toBe(10);
      const last = await prisma.orderStatusHistory.findFirstOrThrow({
        where: { orderId: o.orderId },
        orderBy: { createdAt: 'desc' },
      });
      expect(last).toMatchObject({
        fromStatus: 'PACKING',
        toStatus: 'CANCELLED',
        changedById: warehouse.id,
        note: 'Không liên lạc được khách · Hoàn tiền (giả lập)',
      });

      // Admin huỷ đơn chưa thanh toán: không ghi hoàn tiền
      const admin = await loginAs(Role.ADMIN);
      const unpaid = await newOrder({ paid: false });
      await cancel(admin.token, unpaid.orderId, {
        reason: 'Đơn đặt thử',
      }).expect(200);
      expect(
        (
          await prisma.orderStatusHistory.findFirstOrThrow({
            where: { orderId: unpaid.orderId, toStatus: 'CANCELLED' },
          })
        ).note,
      ).toBe('Đơn đặt thử');

      const shipping = await newOrder();
      for (const status of ['CONFIRMED', 'PACKING', 'SHIPPING']) {
        await advance(warehouse.token, shipping.orderId, { status }).expect(
          200,
        );
      }
      const res = await cancel(warehouse.token, shipping.orderId, {
        reason: 'Khách đổi ý',
      }).expect(409);
      expect(res.body.message).toBe(
        "Không thể huỷ đơn đang ở trạng thái 'Đang giao'",
      );
      expect(await stockOf(shipping.productId)).toBe(8);
    });

    it('TC44 danh sách cho nhân viên: lọc trạng thái, tìm mã/SĐT, khoảng ngày, sắp xếp, việc làm được tiếp', async () => {
      const phone = uniquePhone();
      const first = await newOrder({ phone });
      const second = await newOrder({ phone, paid: false });
      const third = await newOrder({ phone });
      for (const status of ['CONFIRMED', 'PACKING', 'SHIPPING']) {
        await advance(warehouse.token, third.orderId, { status }).expect(200);
      }

      const byPhone = await listStaff(warehouse.token, `?q=${phone}`).expect(
        200,
      );
      expect(byPhone.body.items.map((o: { id: string }) => o.id)).toEqual([
        third.orderId,
        second.orderId,
        first.orderId,
      ]);
      const oldest = await listStaff(
        warehouse.token,
        `?q=${phone}&sort=oldest`,
      ).expect(200);
      expect(oldest.body.items[0].id).toBe(first.orderId);

      const [card] = (
        await listStaff(warehouse.token, `?q=${phone}&status=PAID`).expect(200)
      ).body.items;
      expect(card).toMatchObject({
        id: first.orderId,
        recipientPhone: phone,
        customer: { id: first.customer.id },
        nextStatus: 'CONFIRMED',
        canStaffCancel: true,
        itemCount: 1,
        totalQuantity: 2,
      });
      const shipping = (
        await listStaff(
          warehouse.token,
          `?q=${phone}&status=SHIPPING,PENDING_PAYMENT`,
        ).expect(200)
      ).body.items;
      expect(shipping.map((o: { id: string }) => o.id).sort()).toEqual(
        [second.orderId, third.orderId].sort(),
      );
      expect(
        shipping.find((o: { id: string }) => o.id === third.orderId),
      ).toMatchObject({
        nextStatus: 'DELIVERED',
        canStaffCancel: false,
      });
      expect(
        shipping.find((o: { id: string }) => o.id === second.orderId),
      ).toMatchObject({
        nextStatus: null,
        canStaffCancel: true,
      });

      // Một phần mã đơn, chữ thường
      const byCode = await listStaff(
        warehouse.token,
        `?q=${first.code.slice(-6).toLowerCase()}`,
      ).expect(200);
      expect(byCode.body.items.map((o: { id: string }) => o.id)).toContain(
        first.orderId,
      );

      const today = new Date(Date.now() + 7 * 60 * 60_000)
        .toISOString()
        .slice(0, 10);
      const tomorrow = new Date(Date.now() + 31 * 60 * 60_000)
        .toISOString()
        .slice(0, 10);
      const inToday = await listStaff(
        warehouse.token,
        `?q=${phone}&from=${today}&to=${today}`,
      ).expect(200);
      expect(inToday.body.meta.total).toBe(3);
      const fromTomorrow = await listStaff(
        warehouse.token,
        `?q=${phone}&from=${tomorrow}`,
      ).expect(200);
      expect(fromTomorrow.body.meta.total).toBe(0);

      await listStaff(warehouse.token, '?from=2026-02-30').expect(400);
      await listStaff(warehouse.token, '?from=30-10-2026').expect(400);
      await listStaff(warehouse.token, '?from=2026-10-30&to=2026-10-01').expect(
        400,
      );
      await listStaff(warehouse.token, '?sort=price').expect(400);
    });

    it('TC45 phân quyền: khách không xem danh sách / đổi trạng thái; CSKH chỉ xem; không có token => 401', async () => {
      const o = await newOrder();
      const support = await loginAs(Role.SUPPORT);

      await listStaff(o.customer.token).expect(403);
      await advance(o.customer.token, o.orderId, {
        status: 'CONFIRMED',
      }).expect(403);

      await listStaff(support.token, `?q=${o.phone}`).expect(200);
      await advance(support.token, o.orderId, { status: 'CONFIRMED' }).expect(
        403,
      );

      await http.get(`${API}/orders`).expect(401);
      await http
        .patch(`${API}/orders/${o.orderId}/status`)
        .send({ status: 'CONFIRMED' })
        .expect(401);
      expect(await statusOf(o.orderId)).toBe('PAID');
    });
  });
});
