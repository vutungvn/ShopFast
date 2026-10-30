/**
 * Seed dữ liệu danh mục, thương hiệu, sản phẩm, tài khoản mẫu và đơn hàng.
 *   npm run db:seed                       # 200 sản phẩm, 20 khách, 120 đơn (mặc định)
 *   SEED_PRODUCTS=1000 npm run db:seed    # số lượng tuỳ chọn
 *   SEED_CUSTOMERS=50 SEED_ORDERS=300 SEED_PASSWORD=... npm run db:seed
 * Chạy lại an toàn: chỉ thêm bản ghi chưa có (theo slug/SKU), không ghi đè dữ liệu đã sửa.
 * Dữ liệu sinh theo PRNG cố định nên mỗi lần chạy ra cùng một bộ sản phẩm.
 */
import { PrismaClient } from '@prisma/client';
import { slugify } from '../src/common/utils/slug';
import { seedAccountsAndOrders } from './seed-orders';

const prisma = new PrismaClient();
const PRODUCT_COUNT = Number(process.env.SEED_PRODUCTS ?? 200);

/** mulberry32: PRNG đơn giản, có seed để dữ liệu lặp lại được. */
function createRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = createRandom(20261026);
const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

/** Danh mục lá: thương hiệu phù hợp, mẫu tên, khoảng giá (VND). */
interface LeafCategory {
  name: string;
  brands: string[];
  models: string[];
  variants: string[];
  price: [number, number];
}

const CATALOG: Record<string, LeafCategory[]> = {
  'Điện tử': [
    {
      name: 'Điện thoại',
      brands: ['Apple', 'Samsung', 'Xiaomi', 'OPPO'],
      models: ['Pro', 'Ultra', 'Lite', 'Plus', 'Max', 'Neo'],
      variants: ['128GB', '256GB', '512GB'],
      price: [3_000_000, 35_000_000],
    },
    {
      name: 'Laptop',
      brands: ['Apple', 'Dell', 'Asus', 'Lenovo', 'HP'],
      models: ['Air', 'Pro', 'Gaming', 'Slim', 'Creator', 'Business'],
      variants: ['13 inch', '14 inch', '15.6 inch', '16 inch'],
      price: [10_000_000, 60_000_000],
    },
    {
      name: 'Máy tính bảng',
      brands: ['Apple', 'Samsung', 'Xiaomi', 'Lenovo'],
      models: ['Tab', 'Pad', 'Mini', 'Pro'],
      variants: ['Wi-Fi 64GB', 'Wi-Fi 128GB', '5G 256GB'],
      price: [4_000_000, 30_000_000],
    },
    {
      name: 'Tai nghe',
      brands: ['Apple', 'Sony', 'Samsung', 'JBL'],
      models: ['Buds', 'Pods', 'Studio', 'Sport'],
      variants: ['Đen', 'Trắng', 'Xanh'],
      price: [500_000, 9_000_000],
    },
  ],
  'Gia dụng': [
    {
      name: 'Nồi cơm điện',
      brands: ['Sharp', 'Panasonic', 'Philips', 'Sunhouse'],
      models: ['Cao tần', 'Điện tử', 'Nắp gài'],
      variants: ['1L', '1.5L', '1.8L'],
      price: [500_000, 6_000_000],
    },
    {
      name: 'Nồi chiên không dầu',
      brands: ['Philips', 'Sunhouse', 'Xiaomi', 'Lock&Lock'],
      models: ['Classic', 'Digital', 'XL'],
      variants: ['4L', '5.5L', '7L'],
      price: [1_000_000, 7_000_000],
    },
    {
      name: 'Máy lọc không khí',
      brands: ['Sharp', 'Xiaomi', 'Philips', 'Panasonic'],
      models: ['Smart', 'Pro', 'Compact'],
      variants: ['20m²', '35m²', '50m²'],
      price: [2_000_000, 15_000_000],
    },
  ],
  'Thời trang': [
    {
      name: 'Giày thể thao',
      brands: ['Nike', 'Adidas', 'Puma'],
      models: ['Runner', 'Court', 'Street', 'Trail'],
      variants: ['Size 39', 'Size 40', 'Size 41', 'Size 42'],
      price: [800_000, 5_000_000],
    },
    {
      name: 'Áo thun',
      brands: ['Uniqlo', 'Nike', 'Adidas', 'Coolmate'],
      models: ['Basic', 'Oversize', 'Dry-Fit', 'Cotton'],
      variants: ['S', 'M', 'L', 'XL'],
      price: [150_000, 900_000],
    },
  ],
};

async function upsertCategory(name: string, parentId?: string) {
  const slug = slugify(name);
  return prisma.category.upsert({
    where: { slug },
    create: { name, slug, parentId },
    update: {},
  });
}

async function main() {
  // 1. Danh mục 2 cấp
  const leaves: { id: string; spec: LeafCategory }[] = [];
  for (const [rootName, children] of Object.entries(CATALOG)) {
    const root = await upsertCategory(rootName);
    for (const spec of children) {
      const leaf = await upsertCategory(spec.name, root.id);
      leaves.push({ id: leaf.id, spec });
    }
  }

  // 2. Thương hiệu
  const brandNames = [...new Set(leaves.flatMap((l) => l.spec.brands))];
  const brandIds = new Map<string, string>();
  for (const name of brandNames) {
    const slug = slugify(name);
    const brand = await prisma.brand.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
    });
    brandIds.set(name, brand.id);
  }

  // 3. Sản phẩm: ~10% hết hàng, ~5% ngừng bán
  let created = 0;
  for (let i = 1; i <= PRODUCT_COUNT; i++) {
    const { id: categoryId, spec } = pick(leaves);
    const brandName = pick(spec.brands);
    const sku = `SF-${String(i).padStart(5, '0')}`;
    const name = `${spec.name} ${brandName} ${pick(spec.models)} ${pick(spec.variants)}`;
    const price =
      Math.round(between(spec.price[0], spec.price[1]) / 10_000) * 10_000;
    const stock = random() < 0.1 ? 0 : between(1, 200);
    const isActive = random() >= 0.05;

    const exists = await prisma.product.findUnique({ where: { sku } });
    if (exists) continue;
    await prisma.product.create({
      data: {
        sku,
        name,
        slug: `${slugify(name)}-${sku.toLowerCase()}`,
        description: `${name} chính hãng ${brandName}, bảo hành 12 tháng.`,
        price,
        isActive,
        categoryId,
        brandId: brandIds.get(brandName)!,
        inventory: { create: { stock } },
      },
    });
    created++;
  }

  console.log(
    `Seed xong: ${leaves.length} danh mục lá, ${brandNames.length} thương hiệu, ` +
      `thêm ${created}/${PRODUCT_COUNT} sản phẩm (phần còn lại đã có sẵn).`,
  );

  // 4. Tài khoản mẫu + đơn hàng ở đủ các trạng thái
  const seeded = await seedAccountsAndOrders(prisma, random);
  console.log(
    `Tài khoản mẫu (mật khẩu ${seeded.password}): ${seeded.staff.join(', ')}, ` +
      `khach01..${String(seeded.customers).padStart(2, '0')}@shopfast.vn. ` +
      `Thêm ${seeded.created} đơn hàng, bỏ qua ${seeded.skipped} đơn đã có.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
