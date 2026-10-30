import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
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
});
