import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { InventoryStatsDto } from './dto/inventory-stats.dto';
import { ProductSort } from './dto/product-query.dto';
import { LOW_STOCK_THRESHOLD } from './products.constants';

/** Quan hệ luôn kèm theo sản phẩm; giỏ hàng dùng lại để trả cùng một dạng dữ liệu. */
export const productInclude = {
  category: { select: { id: true, name: true, slug: true, parentId: true } },
  brand: { select: { id: true, name: true, slug: true } },
  inventory: { select: { stock: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

export interface ProductFilter {
  categoryIds?: string[];
  brandSlugs?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  q?: string;
  isActive?: boolean;
  /** Còn 1..LOW_STOCK_THRESHOLD */
  lowStock?: boolean;
}

// Luôn kèm id để thứ tự ổn định khi nhiều sản phẩm trùng giá/tên, tránh lặp hoặc sót giữa các trang
const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> =
  {
    [ProductSort.NEWEST]: [{ createdAt: 'desc' }, { id: 'asc' }],
    [ProductSort.PRICE_ASC]: [{ price: 'asc' }, { id: 'asc' }],
    [ProductSort.PRICE_DESC]: [{ price: 'desc' }, { id: 'asc' }],
    [ProductSort.NAME_ASC]: [{ name: 'asc' }, { id: 'asc' }],
  };

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    filter: ProductFilter;
    sort: ProductSort;
    skip: number;
    take: number;
  }): Promise<[ProductWithRelations[], number]> {
    const where = buildWhere(params.filter);
    return this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: ORDER_BY[params.sort],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.product.count({ where }),
    ]);
  }

  /** Số liệu cho màn tồn kho; sắp hết / hết hàng chỉ tính sản phẩm đang bán */
  async stockStats(): Promise<InventoryStatsDto> {
    const [total, lowStock, outOfStock, inactive] =
      await this.prisma.$transaction([
        this.prisma.product.count(),
        this.prisma.product.count({
          where: buildWhere({ isActive: true, lowStock: true }),
        }),
        this.prisma.product.count({
          where: buildWhere({ isActive: true, inStock: false }),
        }),
        this.prisma.product.count({ where: { isActive: false } }),
      ]);
    return { total, lowStock, outOfStock, inactive };
  }

  findById(id: string): Promise<ProductWithRelations | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
  }

  findBySlug(slug: string): Promise<ProductWithRelations | null> {
    return this.prisma.product.findUnique({
      where: { slug },
      include: productInclude,
    });
  }

  /** Tạo sản phẩm cùng bản ghi tồn kho trong một câu lệnh. */
  create(
    data: Omit<Prisma.ProductUncheckedCreateInput, 'inventory'>,
    stock: number,
  ): Promise<ProductWithRelations> {
    return this.prisma.product.create({
      data: { ...data, inventory: { create: { stock } } },
      include: productInclude,
    });
  }

  /** Đặt lại số tồn; sản phẩm chưa có bản ghi tồn kho thì tạo. */
  async setStock(productId: string, stock: number): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO inventories ("productId", stock, "updatedAt")
      VALUES (${productId}::uuid, ${stock}, now())
      ON CONFLICT ("productId") DO UPDATE SET stock = EXCLUDED.stock, "updatedAt" = now()`;
  }

  /**
   * Cộng/trừ tồn kho nguyên tử, không cho xuống dưới 0 (cùng cách trừ kho khi đặt đơn).
   * Trừ quá số đang có thì không đổi gì và trả về tồn kho hiện tại.
   */
  async adjustStock(
    productId: string,
    delta: number,
  ): Promise<{ ok: true } | { ok: false; stock: number }> {
    const updated = await this.prisma.$executeRaw`
      UPDATE inventories SET stock = stock + ${delta}, "updatedAt" = now()
      WHERE "productId" = ${productId}::uuid AND stock + ${delta} >= 0`;
    if (updated === 1) return { ok: true };

    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
      select: { stock: true },
    });
    // Chưa có bản ghi tồn kho mà nhập thêm: tạo mới (ON CONFLICT phòng request khác vừa tạo)
    if (!inventory && delta > 0) {
      await this.prisma.$executeRaw`
        INSERT INTO inventories ("productId", stock, "updatedAt")
        VALUES (${productId}::uuid, ${delta}, now())
        ON CONFLICT ("productId") DO UPDATE SET stock = inventories.stock + ${delta}, "updatedAt" = now()`;
      return { ok: true };
    }
    return { ok: false, stock: inventory?.stock ?? 0 };
  }

  update(
    id: string,
    data: Prisma.ProductUncheckedUpdateInput,
  ): Promise<ProductWithRelations> {
    return this.prisma.product.update({
      where: { id },
      data,
      include: productInclude,
    });
  }
}

function buildWhere(filter: ProductFilter): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  if (filter.isActive !== undefined) and.push({ isActive: filter.isActive });
  if (filter.categoryIds) and.push({ categoryId: { in: filter.categoryIds } });
  if (filter.brandSlugs?.length) {
    and.push({ brand: { slug: { in: filter.brandSlugs } } });
  }
  if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
    and.push({ price: { gte: filter.minPrice, lte: filter.maxPrice } });
  }
  if (filter.inStock === true) and.push({ inventory: { stock: { gt: 0 } } });
  if (filter.inStock === false) {
    and.push({ OR: [{ inventory: null }, { inventory: { stock: 0 } }] });
  }
  if (filter.lowStock) {
    and.push({ inventory: { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } } });
  }
  if (filter.q) {
    and.push({
      OR: [
        { name: { contains: filter.q, mode: 'insensitive' } },
        { sku: { equals: filter.q, mode: 'insensitive' } },
      ],
    });
  }
  return { AND: and };
}
