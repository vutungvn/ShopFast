import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import request, { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/infra/prisma/prisma.service';

// Cần hạ tầng đang chạy: docker compose up -d
// Mọi dữ liệu test mang tiền tố RUN (slug) / RUN viết hoa (SKU) và bị xoá sau khi chạy,
// nên không phụ thuộc và không ảnh hưởng dữ liệu seed.
const RUN = `e2e${Date.now().toString(36)}`;
const SKU = RUN.toUpperCase();
const PASSWORD = 'MatKhau123';
const API = '/api/v1';

// Cây danh mục fixture:  dien-tu ─┬─ dien-thoai
//                                 └─ laptop
//                        gia-dung
type Fixture = {
  name: string;
  category: 'dienThoai' | 'laptop' | 'giaDung';
  brand: 'apple' | 'samsung' | 'dell';
  price: number;
  stock: number;
  isActive: boolean;
};
const FIXTURES: Record<string, Fixture> = {
  A: { name: 'iphone 15', category: 'dienThoai', brand: 'apple', price: 20_000_000, stock: 5, isActive: true },
  B: { name: 'galaxy s24', category: 'dienThoai', brand: 'samsung', price: 15_000_000, stock: 0, isActive: true },
  C: { name: 'galaxy a55', category: 'dienThoai', brand: 'samsung', price: 8_000_000, stock: 12, isActive: true },
  D: { name: 'xps 13', category: 'laptop', brand: 'dell', price: 25_000_000, stock: 3, isActive: true },
  E: { name: 'macbook air', category: 'laptop', brand: 'apple', price: 30_000_000, stock: 2, isActive: true },
  F: { name: 'iphone 12 cu', category: 'dienThoai', brand: 'apple', price: 10_000_000, stock: 9, isActive: false },
  G: { name: 'noi chien khong dau', category: 'giaDung', brand: 'samsung', price: 3_000_000, stock: 20, isActive: true },
}; // prettier-ignore

/** Mã fixture (A, B, ...) của các sản phẩm trong response, giữ nguyên thứ tự. */
const keys = (res: Response): string[] =>
  res.body.items.map((p: { sku: string }) => p.sku.split('-').pop());

describe('Products, Categories, Brands (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  const cat: Record<string, string> = {};
  const brand: Record<string, string> = {};
  const emails: string[] = [];
  let admin: string;
  let warehouse: string;
  let customer: string;

  const listProducts = (query: Record<string, unknown> = {}) =>
    http.get(`${API}/products`).query(query);
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function tokenFor(role: Role): Promise<string> {
    const email = `products-${role.toLowerCase()}-${RUN}@e2e.test`;
    emails.push(email);
    await prisma.user.create({
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
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());

    const newCategory = async (slug: string, name: string, parentId?: string) =>
      (await prisma.category.create({ data: { slug: `${RUN}-${slug}`, name, parentId } })).id;
    cat.dienTu = await newCategory('dien-tu', 'Điện tử');
    cat.dienThoai = await newCategory('dien-thoai', 'Điện thoại', cat.dienTu);
    cat.laptop = await newCategory('laptop', 'Laptop', cat.dienTu);
    cat.giaDung = await newCategory('gia-dung', 'Gia dụng');

    for (const name of ['Apple', 'Samsung', 'Dell']) {
      const slug = name.toLowerCase();
      brand[slug] = (await prisma.brand.create({ data: { slug: `${RUN}-${slug}`, name } })).id;
    }

    // createdAt tăng dần theo thứ tự A → G để kiểm tra sort=newest
    const base = Date.now() - 60_000;
    for (const [i, [key, f]] of Object.entries(FIXTURES).entries()) {
      await prisma.product.create({
        data: {
          sku: `${SKU}-${key}`,
          name: `${RUN} ${f.name}`,
          slug: `${RUN}-${f.name.replace(/ /g, '-')}`,
          price: f.price,
          isActive: f.isActive,
          categoryId: cat[f.category],
          brandId: brand[f.brand],
          createdAt: new Date(base + i * 1000),
          inventory: { create: { stock: f.stock } },
        },
      });
    }

    admin = await tokenFor(Role.ADMIN);
    warehouse = await tokenFor(Role.WAREHOUSE);
    customer = await tokenFor(Role.CUSTOMER);
  }); // prettier-ignore

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU } } });
    const ours = { slug: { startsWith: RUN } };
    await prisma.category.updateMany({ where: ours, data: { parentId: null } });
    await prisma.category.deleteMany({ where: ours });
    await prisma.brand.deleteMany({ where: ours });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  describe('Danh sách sản phẩm (công khai)', () => {
    it('TC01 không cần đăng nhập, trả items + meta phân trang mặc định (page 1, limit 20)', async () => {
      const res = await listProducts().expect(200);
      expect(res.body.items).toEqual(expect.any(Array));
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
    });

    it('TC02 sản phẩm có đủ thông tin: giá dạng number, tồn kho, danh mục, thương hiệu', async () => {
      const res = await listProducts({ q: `${SKU}-A` }).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        sku: `${SKU}-A`,
        price: 20_000_000,
        stock: 5,
        isActive: true,
        category: { id: cat.dienThoai, slug: `${RUN}-dien-thoai` },
        brand: { id: brand.apple, slug: `${RUN}-apple` },
      });
    });

    it('TC03 sản phẩm ngừng bán (F) không xuất hiện với khách', async () => {
      const res = await listProducts({ q: RUN, limit: 100 }).expect(200);
      expect(keys(res).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'G']);
    });
  });

  describe('Lọc theo danh mục', () => {
    it('TC04 danh mục cha => gồm cả sản phẩm của các danh mục con', async () => {
      const res = await listProducts({ category: `${RUN}-dien-tu` }).expect(
        200,
      );
      expect(keys(res).sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('TC05 danh mục con => chỉ sản phẩm của danh mục đó', async () => {
      const res = await listProducts({ category: `${RUN}-laptop` }).expect(200);
      expect(keys(res).sort()).toEqual(['D', 'E']);
    });

    it('TC06 slug danh mục không tồn tại => 200, danh sách rỗng', async () => {
      const res = await listProducts({ category: `${RUN}-khong-co` }).expect(
        200,
      );
      expect(res.body).toEqual({
        items: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
  });

  describe('Lọc theo thương hiệu', () => {
    it('TC07 một thương hiệu', async () => {
      const res = await listProducts({ brand: `${RUN}-apple` }).expect(200);
      expect(keys(res).sort()).toEqual(['A', 'E']);
    });

    it('TC08 nhiều thương hiệu, cách nhau dấu phẩy', async () => {
      const res = await listProducts({
        brand: `${RUN}-apple,${RUN}-dell`,
      }).expect(200);
      expect(keys(res).sort()).toEqual(['A', 'D', 'E']);
    });

    it('TC09 nhiều thương hiệu, lặp tham số brand=..&brand=..', async () => {
      const res = await http
        .get(`${API}/products?brand=${RUN}-samsung&brand=${RUN}-dell`)
        .expect(200);
      expect(keys(res).sort()).toEqual(['B', 'C', 'D', 'G']);
    });
  });

  describe('Lọc theo khoảng giá', () => {
    it('TC10 minPrice + maxPrice, bao gồm cả hai biên', async () => {
      const res = await listProducts({
        q: RUN,
        minPrice: 8_000_000,
        maxPrice: 20_000_000,
      }).expect(200);
      expect(keys(res).sort()).toEqual(['A', 'B', 'C']);
    });

    it('TC11 chỉ minPrice', async () => {
      const res = await listProducts({ q: RUN, minPrice: 25_000_000 }).expect(
        200,
      );
      expect(keys(res).sort()).toEqual(['D', 'E']);
    });

    it('TC12 chỉ maxPrice', async () => {
      const res = await listProducts({ q: RUN, maxPrice: 8_000_000 }).expect(
        200,
      );
      expect(keys(res).sort()).toEqual(['C', 'G']);
    });

    it('TC13 minPrice > maxPrice => 400', async () => {
      const res = await listProducts({ minPrice: 500, maxPrice: 100 }).expect(
        400,
      );
      expect(res.body.message).toBe('minPrice không được lớn hơn maxPrice');
    });
  });

  describe('Kết hợp bộ lọc, tìm kiếm, còn hàng', () => {
    it('TC14 danh mục + thương hiệu + khoảng giá cùng lúc', async () => {
      const res = await listProducts({
        category: `${RUN}-dien-tu`,
        brand: `${RUN}-samsung`,
        maxPrice: 10_000_000,
      }).expect(200);
      expect(keys(res)).toEqual(['C']);
    });

    it('TC15 inStock=true loại sản phẩm hết hàng (B); inStock=false chỉ còn B', async () => {
      const inStock = await listProducts({ q: RUN, inStock: true }).expect(200);
      expect(keys(inStock).sort()).toEqual(['A', 'C', 'D', 'E', 'G']);
      const outOfStock = await listProducts({ q: RUN, inStock: false }).expect(200);
      expect(keys(outOfStock)).toEqual(['B']);
    });

    it('TC16 q tìm theo tên không phân biệt hoa thường', async () => {
      const res = await listProducts({ q: `${RUN} GALAXY` }).expect(200);
      expect(keys(res).sort()).toEqual(['B', 'C']);
    });

    it('TC17 q tìm đúng mã SKU (không phân biệt hoa thường)', async () => {
      const res = await listProducts({ q: `${SKU}-d`.toLowerCase() }).expect(200);
      expect(keys(res)).toEqual(['D']);
    });
  }); // prettier-ignore

  describe('Sắp xếp', () => {
    it.each([
      ['newest', ['G', 'E', 'D', 'C', 'B', 'A']],
      ['price_asc', ['G', 'C', 'B', 'A', 'D', 'E']],
      ['price_desc', ['E', 'D', 'A', 'B', 'C', 'G']],
      ['name_asc', ['C', 'B', 'A', 'E', 'G', 'D']],
    ])('TC18 sort=%s', async (sort, expected) => {
      const res = await listProducts({ q: RUN, sort }).expect(200);
      expect(keys(res)).toEqual(expected);
    });

    it('TC19 mặc định sort=newest', async () => {
      const res = await listProducts({ q: RUN }).expect(200);
      expect(keys(res)).toEqual(['G', 'E', 'D', 'C', 'B', 'A']);
    });
  });

  describe('Phân trang', () => {
    const page = (n: number) =>
      listProducts({ q: RUN, sort: 'price_asc', limit: 4, page: n }).expect(200);

    it('TC20 trang 1 và 2 nối tiếp, không trùng, meta đúng', async () => {
      const p1 = await page(1);
      const p2 = await page(2);
      expect(keys(p1)).toEqual(['G', 'C', 'B', 'A']);
      expect(keys(p2)).toEqual(['D', 'E']);
      expect(p1.body.meta).toEqual({ page: 1, limit: 4, total: 6, totalPages: 2 });
      expect(p2.body.meta).toEqual({ page: 2, limit: 4, total: 6, totalPages: 2 });
    });

    it('TC21 trang vượt quá tổng => items rỗng, total vẫn đúng', async () => {
      const p3 = await page(3);
      expect(p3.body.items).toEqual([]);
      expect(p3.body.meta.total).toBe(6);
    });
  }); // prettier-ignore

  describe('Tham số không hợp lệ', () => {
    it.each([
      ['page=0', { page: 0 }],
      ['limit=0', { limit: 0 }],
      ['limit=101', { limit: 101 }],
      ['page không phải số', { page: 'abc' }],
      ['minPrice không phải số', { minPrice: 'abc' }],
      ['maxPrice âm', { maxPrice: -1 }],
      ['sort sai', { sort: 'cheapest' }],
      ['inStock không phải boolean', { inStock: 'yes' }],
      ['tham số lạ', { hack: 1 }],
    ])('TC22 %s => 400', async (_case, query) => {
      await listProducts(query).expect(400);
    });
  });

  describe('Chi tiết sản phẩm', () => {
    it('TC23 xem theo slug => 200 kèm danh mục, thương hiệu, tồn kho', async () => {
      const res = await http
        .get(`${API}/products/${RUN}-macbook-air`)
        .expect(200);
      expect(res.body).toMatchObject({
        sku: `${SKU}-E`,
        price: 30_000_000,
        stock: 2,
        category: { slug: `${RUN}-laptop` },
        brand: { slug: `${RUN}-apple` },
      });
    });

    it('TC24 slug không tồn tại => 404', async () => {
      const res = await http.get(`${API}/products/${RUN}-khong-co`).expect(404);
      expect(res.body.message).toBe('Không tìm thấy sản phẩm');
    });

    it('TC25 sản phẩm ngừng bán => 404 với khách', async () => {
      await http.get(`${API}/products/${RUN}-iphone-12-cu`).expect(404);
    });
  });

  describe('Danh sách cho nhân viên GET /products/manage', () => {
    it('TC26 chưa đăng nhập => 401; CUSTOMER => 403', async () => {
      await http.get(`${API}/products/manage`).expect(401);
      await http
        .get(`${API}/products/manage`)
        .set(bearer(customer))
        .expect(403);
    });

    it('TC27 WAREHOUSE thấy cả sản phẩm ngừng bán; lọc isActive=false', async () => {
      const all = await http
        .get(`${API}/products/manage`)
        .query({ q: RUN })
        .set(bearer(warehouse))
        .expect(200);
      expect(keys(all).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

      const inactive = await http
        .get(`${API}/products/manage`)
        .query({ q: RUN, isActive: false })
        .set(bearer(warehouse))
        .expect(200);
      expect(keys(inactive)).toEqual(['F']);
    });
  });

  describe('Quản lý sản phẩm (ADMIN)', () => {
    const NAME = `Điện Thoại Thử ${RUN.slice(3)}`;
    const AUTO_SLUG = `dien-thoai-thu-${RUN.slice(3)}`;
    const body = (extra: Record<string, unknown> = {}) => ({
      sku: `${RUN}-new`,
      name: NAME,
      price: 12_500_000,
      categoryId: cat.dienThoai,
      brandId: brand.samsung,
      stock: 15,
      ...extra,
    });
    let createdId: string;

    it('TC28 chưa đăng nhập => 401; CUSTOMER, WAREHOUSE => 403', async () => {
      await http.post(`${API}/products`).send(body()).expect(401);
      await http.post(`${API}/products`).set(bearer(customer)).send(body()).expect(403);
      await http.post(`${API}/products`).set(bearer(warehouse)).send(body()).expect(403);
    });

    it('TC29 ADMIN tạo sản phẩm => 201, SKU viết hoa, slug tự sinh từ tên tiếng Việt, có tồn kho', async () => {
      const res = await http.post(`${API}/products`).set(bearer(admin)).send(body()).expect(201);
      createdId = res.body.id;
      expect(res.body).toMatchObject({
        sku: `${SKU}-NEW`,
        slug: AUTO_SLUG,
        price: 12_500_000,
        stock: 15,
        isActive: true,
      });
      const inventory = await prisma.inventory.findUnique({ where: { productId: createdId } });
      expect(inventory?.stock).toBe(15);
      await http.get(`${API}/products/${AUTO_SLUG}`).expect(200);
    });

    it('TC30 SKU trùng => 409; slug trùng => 409', async () => {
      const dupSku = await http
        .post(`${API}/products`)
        .set(bearer(admin))
        .send(body({ slug: `${RUN}-khac` }))
        .expect(409);
      expect(dupSku.body.message).toBe('SKU đã tồn tại');

      const dupSlug = await http
        .post(`${API}/products`)
        .set(bearer(admin))
        .send(body({ sku: `${RUN}-new-2` }))
        .expect(409);
      expect(dupSlug.body.message).toBe('Slug sản phẩm đã tồn tại');
    });

    it('TC31 danh mục / thương hiệu không tồn tại => 400', async () => {
      const noCat = await http
        .post(`${API}/products`)
        .set(bearer(admin))
        .send(body({ sku: `${RUN}-x1`, slug: `${RUN}-x1`, categoryId: randomUUID() }))
        .expect(400);
      expect(noCat.body.message).toBe('Danh mục không tồn tại');

      const noBrand = await http
        .post(`${API}/products`)
        .set(bearer(admin))
        .send(body({ sku: `${RUN}-x2`, slug: `${RUN}-x2`, brandId: randomUUID() }))
        .expect(400);
      expect(noBrand.body.message).toBe('Thương hiệu không tồn tại');
    });

    it.each([
      ['thiếu tên', { name: '' }],
      ['giá âm', { price: -1 }],
      ['giá bằng 0', { price: 0 }],
      ['giá dạng chuỗi', { price: '1000' }],
      ['giá quá 2 chữ số thập phân', { price: 1000.123 }],
      ['tồn kho âm', { stock: -5 }],
      ['tồn kho lẻ', { stock: 1.5 }],
      ['SKU có ký tự lạ', { sku: 'ab c!' }],
      ['slug sai định dạng', { slug: 'Có Dấu' }],
      ['categoryId không phải uuid', { categoryId: '123' }],
      ['field lạ', { hack: true }],
    ])('TC32 dữ liệu không hợp lệ (%s) => 400', async (_case, extra) => {
      await http
        .post(`${API}/products`)
        .set(bearer(admin))
        .send(body({ sku: `${RUN}-bad`, slug: `${RUN}-bad`, ...extra }))
        .expect(400);
    });

    it('TC33 ADMIN sửa giá => khách thấy giá mới ngay', async () => {
      await http
        .patch(`${API}/products/${createdId}`)
        .set(bearer(admin))
        .send({ price: 11_000_000 })
        .expect(200);
      const res = await http.get(`${API}/products/${AUTO_SLUG}`).expect(200);
      expect(res.body.price).toBe(11_000_000);
      expect(res.body.name).toBe(NAME); // field không gửi thì giữ nguyên
    });

    it('TC34 PATCH gửi null cho field bắt buộc, hoặc gửi stock => 400', async () => {
      const patch = (data: object) =>
        http.patch(`${API}/products/${createdId}`).set(bearer(admin)).send(data);
      await patch({ name: null }).expect(400);
      await patch({ price: null }).expect(400);
      await patch({ stock: 100 }).expect(400);
    });

    it('TC35 PATCH sản phẩm không tồn tại => 404; id sai định dạng => 400', async () => {
      await http.patch(`${API}/products/${randomUUID()}`).set(bearer(admin)).send({ price: 1 }).expect(404);
      await http.patch(`${API}/products/khong-phai-uuid`).set(bearer(admin)).send({ price: 1 }).expect(400);
    });

    it('TC36 ngừng bán (isActive=false) => biến mất khỏi danh sách và chi tiết công khai', async () => {
      await http
        .patch(`${API}/products/${createdId}`)
        .set(bearer(admin))
        .send({ isActive: false })
        .expect(200);
      await http.get(`${API}/products/${AUTO_SLUG}`).expect(404);
      const res = await listProducts({ q: `${SKU}-NEW` }).expect(200);
      expect(res.body.items).toEqual([]);
    });
  }); // prettier-ignore

  describe('Danh mục', () => {
    it('TC37 GET /categories công khai, trả cây lồng nhau', async () => {
      const res = await http.get(`${API}/categories`).expect(200);
      const root = res.body.find((c: { id: string }) => c.id === cat.dienTu);
      expect(root.parentId).toBeNull();
      expect(root.children.map((c: { slug: string }) => c.slug).sort()).toEqual(
        [`${RUN}-dien-thoai`, `${RUN}-laptop`].sort(),
      );
    });

    it('TC38 chưa đăng nhập => 401; CUSTOMER tạo danh mục => 403', async () => {
      await http.post(`${API}/categories`).send({ name: 'X' }).expect(401);
      await http.post(`${API}/categories`).set(bearer(customer)).send({ name: 'X' }).expect(403);
    });

    let phuKien: string;
    it('TC39 ADMIN tạo danh mục con, slug tự sinh', async () => {
      const res = await http
        .post(`${API}/categories`)
        .set(bearer(admin))
        .send({ name: `${RUN} Phụ Kiện`, parentId: cat.dienTu })
        .expect(201);
      phuKien = res.body.id;
      expect(res.body).toMatchObject({ slug: `${RUN}-phu-kien`, parentId: cat.dienTu });
    });

    it('TC40 slug trùng => 409; danh mục cha không tồn tại => 400', async () => {
      await http
        .post(`${API}/categories`)
        .set(bearer(admin))
        .send({ name: 'Bất kỳ', slug: `${RUN}-laptop` })
        .expect(409);
      await http
        .post(`${API}/categories`)
        .set(bearer(admin))
        .send({ name: `${RUN} Mồ côi`, parentId: randomUUID() })
        .expect(400);
    });

    it('TC41 chuyển danh mục vào con của chính nó => 400', async () => {
      await http
        .patch(`${API}/categories/${cat.dienTu}`)
        .set(bearer(admin))
        .send({ parentId: cat.laptop })
        .expect(400);
    });

    it('TC42 đổi tên và chuyển cha hợp lệ; parentId=null => thành gốc', async () => {
      const moved = await http
        .patch(`${API}/categories/${phuKien}`)
        .set(bearer(admin))
        .send({ name: 'Phụ kiện số', parentId: cat.giaDung })
        .expect(200);
      expect(moved.body).toMatchObject({ name: 'Phụ kiện số', parentId: cat.giaDung, slug: `${RUN}-phu-kien` });

      const root = await http
        .patch(`${API}/categories/${phuKien}`)
        .set(bearer(admin))
        .send({ parentId: null })
        .expect(200);
      expect(root.body.parentId).toBeNull();
    });

    it('TC43 xoá danh mục còn con => 409; còn sản phẩm => 409; danh mục rỗng => 200 kèm message', async () => {
      const hasChildren = await http.delete(`${API}/categories/${cat.dienTu}`).set(bearer(admin)).expect(409);
      expect(hasChildren.body.message).toBe('Danh mục còn danh mục con, không thể xoá');
      const hasProducts = await http.delete(`${API}/categories/${cat.laptop}`).set(bearer(admin)).expect(409);
      expect(hasProducts.body.message).toBe('Danh mục còn sản phẩm, không thể xoá');

      const deleted = await http.delete(`${API}/categories/${phuKien}`).set(bearer(admin)).expect(200);
      expect(deleted.body).toEqual({ message: 'Đã xoá danh mục' });
      const again = await http.delete(`${API}/categories/${phuKien}`).set(bearer(admin)).expect(404);
      expect(again.body.message).toBe('Không tìm thấy danh mục');
    });
  }); // prettier-ignore

  describe('Thương hiệu', () => {
    it('TC44 GET /brands công khai, sắp xếp theo tên', async () => {
      const res = await http.get(`${API}/brands`).expect(200);
      const ours = res.body
        .filter((b: { slug: string }) => b.slug.startsWith(RUN))
        .map((b: { name: string }) => b.name);
      expect(ours).toEqual(['Apple', 'Dell', 'Samsung']);
    });

    it('TC45 CUSTOMER tạo thương hiệu => 403', async () => {
      await http.post(`${API}/brands`).set(bearer(customer)).send({ name: 'X' }).expect(403);
    });

    let sony: string;
    it('TC46 ADMIN tạo => 201 slug tự sinh; trùng slug => 409', async () => {
      const res = await http.post(`${API}/brands`).set(bearer(admin)).send({ name: `${RUN} Sony` }).expect(201);
      sony = res.body.id;
      expect(res.body.slug).toBe(`${RUN}-sony`);
      await http.post(`${API}/brands`).set(bearer(admin)).send({ name: `${RUN} SONY` }).expect(409);
    });

    it('TC47 ADMIN đổi tên => 200, slug giữ nguyên', async () => {
      const res = await http.patch(`${API}/brands/${sony}`).set(bearer(admin)).send({ name: 'Sony Việt Nam' }).expect(200);
      expect(res.body).toMatchObject({ name: 'Sony Việt Nam', slug: `${RUN}-sony` });
    });

    it('TC48 xoá thương hiệu còn sản phẩm => 409; chưa có sản phẩm => 200 kèm message', async () => {
      const hasProducts = await http.delete(`${API}/brands/${brand.dell}`).set(bearer(admin)).expect(409);
      expect(hasProducts.body.message).toBe('Thương hiệu còn sản phẩm, không thể xoá');
      const deleted = await http.delete(`${API}/brands/${sony}`).set(bearer(admin)).expect(200);
      expect(deleted.body).toEqual({ message: 'Đã xoá thương hiệu' });
      await http.delete(`${API}/brands/${sony}`).set(bearer(admin)).expect(404);
    });
  }); // prettier-ignore
});
