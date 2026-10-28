import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/infra/prisma/prisma.service';

// Cần hạ tầng đang chạy: docker compose up -d
// Dữ liệu test mang tiền tố RUN (slug, email) / RUN viết hoa (SKU) và bị xoá sau khi chạy.
const RUN = `e2ecart${Date.now().toString(36)}`;
const SKU = RUN.toUpperCase();
const PASSWORD = 'MatKhau123';
const API = '/api/v1';

type CartBody = {
  items: Array<{
    product: { id: string; price: number; stock: number };
    quantity: number;
    lineTotal: number;
    issue: string | null;
  }>;
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  canCheckout: boolean;
};

describe('Cart (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let categoryId: string;
  let brandId: string;
  const emails: string[] = [];
  const product: Record<string, string> = {};

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

  async function createProduct(
    key: string,
    price: number,
    stock: number,
    isActive = true,
  ) {
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

  const setStock = (key: string, stock: number) =>
    prisma.inventory.update({
      where: { productId: product[key] },
      data: { stock },
    });

  // Mỗi test dùng một khách mới để giỏ không ảnh hưởng nhau
  const customer = () => loginAs(Role.CUSTOMER);
  const getCart = (token: string) => http.get(`${API}/cart`).set(bearer(token));
  const add = (token: string, productId: string, quantity: number) =>
    http
      .post(`${API}/cart/items`)
      .set(bearer(token))
      .send({ productId, quantity });
  const patch = (token: string, productId: string, quantity: unknown) =>
    http
      .patch(`${API}/cart/items/${productId}`)
      .set(bearer(token))
      .send({ quantity });
  const remove = (token: string, productId: string) =>
    http.delete(`${API}/cart/items/${productId}`).set(bearer(token));

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
        data: { name: `${RUN} Laptop`, slug: `${RUN}-laptop` },
      })
    ).id;
    brandId = (
      await prisma.brand.create({
        data: { name: `${RUN} HP`, slug: `${RUN}-hp` },
      })
    ).id;

    product.MAIN = await createProduct('MAIN', 22_990_000, 10);
    product.CHEAP = await createProduct('CHEAP', 150_000, 500);
    product.OOS = await createProduct('OOS', 990_000, 0);
    product.OFF = await createProduct('OFF', 5_000_000, 10, false);
    product.RACE = await createProduct('RACE', 1_000_000, 5);
    product.EDIT = await createProduct('EDIT', 2_000_000, 10);
  });

  afterAll(async () => {
    // Xoá user trước: giỏ và các dòng trong giỏ bị xoá theo (cascade), sau đó mới xoá được sản phẩm
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU } } });
    await prisma.category.deleteMany({ where: { slug: { startsWith: RUN } } });
    await prisma.brand.deleteMany({ where: { slug: { startsWith: RUN } } });
    await app.close();
  });

  describe('Phân quyền', () => {
    it('TC01 chưa đăng nhập => 401 ở mọi endpoint', async () => {
      await http.get(`${API}/cart`).expect(401);
      await http
        .post(`${API}/cart/items`)
        .send({ productId: product.MAIN, quantity: 1 })
        .expect(401);
      await http.delete(`${API}/cart`).expect(401);
    });

    it.each([Role.WAREHOUSE, Role.SUPPORT, Role.ADMIN])(
      'TC02 %s không có giỏ => 403',
      async (role) => {
        const staff = await loginAs(role);
        await getCart(staff.token).expect(403);
        await add(staff.token, product.MAIN, 1).expect(403);
      },
    );
  });

  describe('Xem và thêm vào giỏ', () => {
    it('TC03 chưa từng thêm => giỏ rỗng, KHÔNG tạo bản ghi giỏ', async () => {
      const c = await customer();
      const res = await getCart(c.token).expect(200);
      expect(res.body).toEqual({
        items: [],
        itemCount: 0,
        totalQuantity: 0,
        subtotal: 0,
        canCheckout: false,
      });
      expect(await prisma.cart.count({ where: { userId: c.id } })).toBe(0);
    });

    it('TC04 thêm sản phẩm => 200, trả toàn bộ giỏ với giá, thành tiền, tạm tính', async () => {
      const c = await customer();
      const res = await add(c.token, product.MAIN, 2).expect(200);
      const body = res.body as CartBody;
      expect(body).toMatchObject({
        itemCount: 1,
        totalQuantity: 2,
        subtotal: 45_980_000,
        canCheckout: true,
      });
      expect(body.items[0]).toMatchObject({
        product: { id: product.MAIN, price: 22_990_000, stock: 10 },
        quantity: 2,
        lineTotal: 45_980_000,
        issue: null,
      });
    });

    it('TC05 thêm lại cùng sản phẩm => cộng dồn trên cùng một dòng', async () => {
      const c = await customer();
      await add(c.token, product.MAIN, 2).expect(200);
      const res = await add(c.token, product.MAIN, 3).expect(200);
      expect(res.body.itemCount).toBe(1);
      expect(res.body.items[0].quantity).toBe(5);
    });

    it('TC06 sản phẩm thêm sau đứng đầu danh sách', async () => {
      const c = await customer();
      await add(c.token, product.MAIN, 1).expect(200);
      const res = await add(c.token, product.CHEAP, 1).expect(200);
      expect((res.body as CartBody).items.map((i) => i.product.id)).toEqual([
        product.CHEAP,
        product.MAIN,
      ]);
    });

    it('TC07 cộng dồn vượt tồn kho => 409 kèm số còn lại và số đã có, giỏ giữ nguyên', async () => {
      const c = await customer();
      await add(c.token, product.MAIN, 8).expect(200);
      const res = await add(c.token, product.MAIN, 3).expect(409);
      expect(res.body.message).toBe(
        'Chỉ còn 10 sản phẩm trong kho (giỏ đã có 8)',
      );
      expect((await getCart(c.token)).body.items[0].quantity).toBe(8);
    });

    it('TC08 sản phẩm hết hàng => 409 "Sản phẩm đã hết hàng"', async () => {
      const c = await customer();
      const res = await add(c.token, product.OOS, 1).expect(409);
      expect(res.body.message).toBe('Sản phẩm đã hết hàng');
    });

    it('TC09 sản phẩm ngừng bán hoặc không tồn tại => 404', async () => {
      const c = await customer();
      const off = await add(c.token, product.OFF, 1).expect(404);
      expect(off.body.message).toBe('Không tìm thấy sản phẩm');
      await add(c.token, randomUUID(), 1).expect(404);
    });

    it('TC10 cộng dồn quá 99 => 400 dù kho còn nhiều', async () => {
      const c = await customer();
      await add(c.token, product.CHEAP, 95).expect(200);
      const res = await add(c.token, product.CHEAP, 5).expect(400);
      expect(res.body.message).toBe(
        'Tối đa 99 sản phẩm mỗi loại (giỏ đã có 95)',
      );
    });

    it.each([
      ['quantity = 0', { quantity: 0 }],
      ['quantity âm', { quantity: -1 }],
      ['quantity = 100', { quantity: 100 }],
      ['quantity lẻ', { quantity: 1.5 }],
      ['quantity dạng chuỗi', { quantity: '2' }],
      ['thiếu productId', { productId: undefined }],
      ['productId không phải uuid', { productId: '123' }],
      ['field lạ', { price: 1 }],
    ])('TC11 dữ liệu không hợp lệ (%s) => 400', async (_case, override) => {
      const c = await customer();
      await http
        .post(`${API}/cart/items`)
        .set(bearer(c.token))
        .send({ productId: product.MAIN, quantity: 1, ...override })
        .expect(400);
    });

    it('TC12 giỏ đã đủ 50 loại => 400 với loại thứ 51; cộng dồn loại đã có vẫn được', async () => {
      const c = await customer();
      const ids = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          createProduct(`BULK${String(i).padStart(2, '0')}`, 10_000, 10),
        ),
      );
      const cart = await prisma.cart.create({ data: { userId: c.id } });
      await prisma.cartItem.createMany({
        data: ids.map((productId) => ({
          cartId: cart.id,
          productId,
          quantity: 1,
        })),
      });

      const res = await add(c.token, product.MAIN, 1).expect(400);
      expect(res.body.message).toBe('Giỏ hàng tối đa 50 loại sản phẩm');
      await add(c.token, ids[0], 1).expect(200);
    });
  });

  describe('Sửa số lượng và xoá', () => {
    it('TC13 PATCH đặt lại số lượng (không cộng dồn)', async () => {
      const c = await customer();
      await add(c.token, product.MAIN, 5).expect(200);
      const res = await patch(c.token, product.MAIN, 2).expect(200);
      expect(res.body.items[0].quantity).toBe(2);
    });

    it('TC14 PATCH vượt tồn kho => 409; sản phẩm không có trong giỏ => 404', async () => {
      const c = await customer();
      await add(c.token, product.MAIN, 1).expect(200);
      const over = await patch(c.token, product.MAIN, 11).expect(409);
      expect(over.body.message).toBe('Chỉ còn 10 sản phẩm trong kho');
      const missing = await patch(c.token, product.CHEAP, 1).expect(404);
      expect(missing.body.message).toBe('Sản phẩm không có trong giỏ');
    });

    it('TC15 PATCH quantity = 0 hoặc null => 400; productId sai định dạng => 400', async () => {
      const c = await customer();
      await add(c.token, product.MAIN, 1).expect(200);
      await patch(c.token, product.MAIN, 0).expect(400);
      await patch(c.token, product.MAIN, null).expect(400);
      await patch(c.token, 'khong-phai-uuid', 1).expect(400);
    });

    it('TC16 DELETE một sản phẩm => trả giỏ còn lại; xoá lại => 404', async () => {
      const c = await customer();
      await add(c.token, product.MAIN, 1).expect(200);
      await add(c.token, product.CHEAP, 1).expect(200);
      const res = await remove(c.token, product.MAIN).expect(200);
      expect((res.body as CartBody).items.map((i) => i.product.id)).toEqual([
        product.CHEAP,
      ]);
      await remove(c.token, product.MAIN).expect(404);
    });

    it('TC17 DELETE /cart => giỏ rỗng; gọi khi chưa có giỏ vẫn 200', async () => {
      const c = await customer();
      await add(c.token, product.MAIN, 1).expect(200);
      await add(c.token, product.CHEAP, 1).expect(200);
      const res = await http
        .delete(`${API}/cart`)
        .set(bearer(c.token))
        .expect(200);
      expect(res.body.items).toEqual([]);
      const fresh = await customer();
      await http.delete(`${API}/cart`).set(bearer(fresh.token)).expect(200);
    });
  });

  describe('Giỏ "cũ": sản phẩm thay đổi sau khi đã thêm', () => {
    beforeEach(async () => {
      await prisma.product.update({
        where: { id: product.EDIT },
        data: { isActive: true, price: 2_000_000 },
      });
      await setStock('EDIT', 10);
    });

    it('TC18 admin đổi giá => giỏ hiện giá mới ngay', async () => {
      const c = await customer();
      await add(c.token, product.EDIT, 2).expect(200);
      await prisma.product.update({
        where: { id: product.EDIT },
        data: { price: 1_500_000 },
      });
      const res = await getCart(c.token).expect(200);
      expect(res.body.items[0]).toMatchObject({
        product: { price: 1_500_000 },
        lineTotal: 3_000_000,
      });
      expect(res.body.subtotal).toBe(3_000_000);
    });

    it('TC19 ngừng bán => INACTIVE, không tính tiền, không đặt hàng được; sửa số lượng => 409; xoá được', async () => {
      const c = await customer();
      await add(c.token, product.MAIN, 1).expect(200);
      await add(c.token, product.EDIT, 2).expect(200);
      await prisma.product.update({
        where: { id: product.EDIT },
        data: { isActive: false },
      });

      const res = await getCart(c.token).expect(200);
      const edit = (res.body as CartBody).items.find(
        (i) => i.product.id === product.EDIT,
      );
      expect(edit?.issue).toBe('INACTIVE');
      expect(res.body).toMatchObject({
        itemCount: 2,
        totalQuantity: 1,
        subtotal: 22_990_000,
        canCheckout: false,
      });

      await patch(c.token, product.EDIT, 1).expect(409);
      const after = await remove(c.token, product.EDIT).expect(200);
      expect(after.body.canCheckout).toBe(true);
    });

    it('TC20 tồn kho giảm dưới số lượng => INSUFFICIENT_STOCK; giảm số lượng về ≤ tồn kho => hết cảnh báo', async () => {
      const c = await customer();
      await add(c.token, product.EDIT, 5).expect(200);
      await setStock('EDIT', 2);

      const res = await getCart(c.token).expect(200);
      expect(res.body.items[0]).toMatchObject({
        issue: 'INSUFFICIENT_STOCK',
        product: { stock: 2 },
      });
      expect(res.body.canCheckout).toBe(false);

      const fixed = await patch(c.token, product.EDIT, 2).expect(200);
      expect(fixed.body.items[0].issue).toBeNull();
      expect(fixed.body.canCheckout).toBe(true);
    });

    it('TC21 hết hàng sau khi đã thêm => OUT_OF_STOCK', async () => {
      const c = await customer();
      await add(c.token, product.EDIT, 1).expect(200);
      await setStock('EDIT', 0);
      const res = await getCart(c.token).expect(200);
      expect(res.body.items[0].issue).toBe('OUT_OF_STOCK');
      expect(res.body.subtotal).toBe(0);
    });
  });

  describe('Tách biệt giữa các khách', () => {
    it('TC22 khách B không thấy và không xoá được hàng trong giỏ khách A', async () => {
      const a = await customer();
      const b = await customer();
      await add(a.token, product.MAIN, 3).expect(200);

      expect((await getCart(b.token).expect(200)).body.items).toEqual([]);
      await remove(b.token, product.MAIN).expect(404);
      await http.delete(`${API}/cart`).set(bearer(b.token)).expect(200);

      expect((await getCart(a.token)).body.items[0].quantity).toBe(3);
    });
  });

  describe('Đồng thời', () => {
    it('TC23 10 request "thêm 1" cùng lúc vào giỏ mới => đúng 10, chỉ 1 giỏ được tạo', async () => {
      const c = await customer();
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => add(c.token, product.CHEAP, 1)),
      );
      expect(responses.map((r) => r.status)).toEqual(Array(10).fill(200));

      const res = await getCart(c.token).expect(200);
      expect(res.body.items[0].quantity).toBe(10);
      expect(await prisma.cart.count({ where: { userId: c.id } })).toBe(1);
    });

    it('TC24 10 request "thêm 1" cùng lúc, kho chỉ còn 5 => đúng 5 thành công, giỏ không vượt kho', async () => {
      const c = await customer();
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => add(c.token, product.RACE, 1)),
      );
      const statuses = responses.map((r) => r.status);
      expect(statuses.filter((s) => s === 200)).toHaveLength(5);
      expect(statuses.filter((s) => s === 409)).toHaveLength(5);

      const res = await getCart(c.token).expect(200);
      expect(res.body.items[0].quantity).toBe(5);
    });

    it('TC25 hai khách cùng thêm món chỉ còn 5 => mỗi người đều được tối đa 5 (giỏ không giữ chỗ)', async () => {
      const a = await customer();
      const b = await customer();
      const [ra, rb] = await Promise.all([
        add(a.token, product.RACE, 5),
        add(b.token, product.RACE, 5),
      ]);
      expect([ra.status, rb.status]).toEqual([200, 200]);
    });
  });
});
