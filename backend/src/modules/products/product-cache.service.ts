import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { Cached, CacheService } from '../../infra/cache/cache.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';

/** Chi tiết: 10 phút; danh sách: 2 phút (nhiều tổ hợp lọc, đổi phiên bản mỗi lần sửa); không có kết quả: 30s */
const DETAIL_TTL = 600;
const LIST_TTL = 120;
const EMPTY_TTL = 30;
/** Mọi danh sách đọc kèm phiên bản này; tăng phiên bản = bỏ toàn bộ danh sách cũ (tự hết hạn sau LIST_TTL) */
const LIST_VERSION_KEY = 'pl:ver';

type ProductPage = PaginatedResult<ProductResponseDto>;

/**
 * Cache sản phẩm cho khách: chi tiết `pd:<slug>` và danh sách đang bán `pl:v<N>:<bộ lọc>`.
 * Danh sách cho nhân viên không cache: kho cần số tồn chính xác.
 * Đọc thẳng Prisma thay vì qua ProductsRepository để danh mục, thương hiệu, đơn hàng và worker
 * dùng được mà không phải import ProductsModule (tránh vòng phụ thuộc với Categories/Brands).
 */
@Injectable()
export class ProductCacheService {
  private readonly logger = new Logger(ProductCacheService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  /** null = không có hoặc đã ngừng bán, cũng được cache (ngắn hơn) để slug lạ không xuống DB liên tục */
  detail(
    slug: string,
    load: () => Promise<ProductResponseDto | null>,
  ): Promise<Cached<ProductResponseDto | null>> {
    return this.cache.getOrSet(
      `pd:${slug}`,
      { group: 'pd', ttl: DETAIL_TTL, emptyTtl: EMPTY_TTL },
      load,
    );
  }

  async list(
    query: ProductQueryDto,
    load: () => Promise<ProductPage>,
  ): Promise<Cached<ProductPage>> {
    const version = await this.cache.getNumber(LIST_VERSION_KEY);
    return this.cache.getOrSet(
      `pl:v${version}:${listKey(query)}`,
      {
        group: 'pl',
        ttl: LIST_TTL,
        emptyTtl: EMPTY_TTL,
        isEmpty: (page) => page.meta.total === 0,
      },
      load,
    );
  }

  /**
   * Gọi sau khi transaction đã ghi xong (giá, thông tin, tồn kho đổi): xoá chi tiết theo slug hiện tại
   * và các slug truyền thêm (slug cũ khi đổi slug), rồi bỏ mọi danh sách. Không ném lỗi: dữ liệu đã lưu,
   * cache sót thì cùng lắm cũ tới hết TTL.
   */
  async invalidate(productIds: string[], extraSlugs: string[] = []) {
    await this.invalidateWhere({ id: { in: productIds } }, extraSlugs);
  }

  /** Danh mục / thương hiệu đổi tên hoặc slug: sản phẩm thuộc nó đang cache kèm thông tin cũ */
  async invalidateByCategory(categoryId: string) {
    await this.invalidateWhere({ categoryId });
  }

  async invalidateByBrand(brandId: string) {
    await this.invalidateWhere({ brandId });
  }

  private async invalidateWhere(
    where: Prisma.ProductWhereInput,
    extraSlugs: string[] = [],
  ) {
    try {
      const products = await this.prisma.product.findMany({
        where,
        select: { slug: true },
      });
      const slugs = new Set([...products.map((p) => p.slug), ...extraSlugs]);
      await Promise.all([
        this.cache.delete(...[...slugs].map((slug) => `pd:${slug}`)),
        this.cache.increment(LIST_VERSION_KEY),
      ]);
    } catch (err) {
      this.logger.warn(
        `Không làm mới được cache sản phẩm: ${(err as Error).message}`,
      );
    }
  }
}

/** Chuẩn hoá bộ lọc (thứ tự thương hiệu, tham số thừa) rồi băm, để cùng một bộ lọc ra cùng một khoá */
function listKey(query: ProductQueryDto): string {
  const normalized = [
    query.category ?? null,
    query.brand ? [...new Set(query.brand)].sort() : null,
    query.minPrice ?? null,
    query.maxPrice ?? null,
    query.inStock ?? null,
    query.q ?? null,
    query.sort,
    query.page,
    query.limit,
  ];
  return createHash('sha1')
    .update(JSON.stringify(normalized))
    .digest('hex')
    .slice(0, 24);
}
