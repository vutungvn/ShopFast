import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ProductSort } from './dto/product-query.dto';

const productInclude = {
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
