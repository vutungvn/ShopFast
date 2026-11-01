import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginate, PaginatedResult } from '../../common/dto/pagination.dto';
import { uniqueViolationFields } from '../../common/prisma/prisma-errors';
import { SLUG_PATTERN, slugify } from '../../common/utils/slug';
import { Cached } from '../../infra/cache/cache.service';
import { BrandsService } from '../brands/brands.service';
import { CategoriesService } from '../categories/categories.service';
import { CreateProductDto } from './dto/create-product.dto';
import {
  ManageProductQueryDto,
  ProductQueryDto,
} from './dto/product-query.dto';
import { InventoryStatsDto } from './dto/inventory-stats.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductCacheService } from './product-cache.service';
import {
  ProductsRepository,
  ProductWithRelations,
} from './products.repository';

/** Giới hạn như khi tạo sản phẩm */
const MAX_SLUG_LENGTH = 220;

@Injectable()
export class ProductsService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly categories: CategoriesService,
    private readonly brands: BrandsService,
    private readonly cache: ProductCacheService,
  ) {}

  /** Danh sách cho khách: chỉ sản phẩm đang bán, qua cache. */
  async listPublic(
    query: ProductQueryDto,
  ): Promise<Cached<PaginatedResult<ProductResponseDto>>> {
    this.assertPriceRange(query);
    return this.cache.list(query, () => this.search(query, true));
  }

  /** Danh sách cho nhân viên: thấy cả sản phẩm đã ngừng bán. */
  listForStaff(
    query: ManageProductQueryDto,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    return this.search(query, query.isActive, query.lowStock);
  }

  /** Sản phẩm đang bán theo slug, qua cache; null = không có hoặc đã ngừng bán */
  async findPublicBySlug(
    slug: string,
  ): Promise<Cached<ProductResponseDto | null>> {
    // Slug sai định dạng chắc chắn không có: trả luôn, không tạo khoá cache rác
    if (slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) {
      return { value: null, status: 'BYPASS' };
    }
    return this.cache.detail(slug, async () => {
      const product = await this.products.findBySlug(slug);
      return product?.isActive ? ProductResponseDto.from(product) : null;
    });
  }

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    const slug = dto.slug ?? slugify(dto.name);
    if (!slug) {
      throw new BadRequestException(
        'Không tạo được slug từ tên, vui lòng nhập slug',
      );
    }
    await this.assertReferences(dto.categoryId, dto.brandId);
    const product = await this.saveUnique(() =>
      this.products.create(
        {
          sku: dto.sku,
          name: dto.name,
          slug,
          description: dto.description,
          imageUrl: dto.imageUrl,
          price: dto.price,
          isActive: dto.isActive,
          categoryId: dto.categoryId,
          brandId: dto.brandId,
        },
        dto.stock,
      ),
    );
    // Xoá cả kết quả "không có" đã cache của slug này
    await this.cache.invalidate([product.id]);
    return ProductResponseDto.from(product);
  }

  /**
   * Kho cập nhật tồn kho: đặt lại (`stock`) hoặc cộng/trừ (`delta`). Sản phẩm ngừng bán vẫn sửa được
   * (tồn kho tách biệt với trạng thái bán). Giá vẫn do ADMIN sửa ở `update`.
   */
  async updateInventory(
    id: string,
    dto: UpdateInventoryDto,
  ): Promise<ProductResponseDto> {
    if ((dto.stock === undefined) === (dto.delta === undefined)) {
      throw new BadRequestException(
        'Gửi đúng một trong hai: stock (đặt lại số tồn) hoặc delta (cộng/trừ)',
      );
    }
    if (!(await this.products.findById(id))) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    if (dto.stock !== undefined) {
      await this.products.setStock(id, dto.stock);
    } else {
      const delta = dto.delta!;
      const result = await this.products.adjustStock(id, delta);
      if (!result.ok) {
        throw new ConflictException(
          `Không đủ tồn kho để trừ ${-delta} (còn ${result.stock})`,
        );
      }
    }
    await this.cache.invalidate([id]);
    return ProductResponseDto.from((await this.products.findById(id))!);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductResponseDto> {
    const current = await this.products.findById(id);
    if (!current) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }
    await this.assertReferences(dto.categoryId, dto.brandId);
    const product = await this.saveUnique(() =>
      this.products.update(id, {
        sku: dto.sku,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        price: dto.price,
        isActive: dto.isActive,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
      }),
    );
    // Đổi slug: khoá chi tiết theo slug cũ cũng phải xoá
    await this.cache.invalidate([id], [current.slug]);
    return ProductResponseDto.from(product);
  }

  /** Số liệu tồn kho cho nhân viên: tổng, sắp hết, hết hàng, ngừng bán */
  stockStats(): Promise<InventoryStatsDto> {
    return this.products.stockStats();
  }

  private async search(
    query: ProductQueryDto,
    isActive: boolean | undefined,
    lowStock?: boolean,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    this.assertPriceRange(query);
    let categoryIds: string[] | undefined;
    if (query.category) {
      const ids = await this.categories.findIdsWithDescendants(query.category);
      // Danh mục không tồn tại => danh sách rỗng, không cần truy vấn sản phẩm
      if (!ids) return paginate([], 0, query);
      categoryIds = ids;
    }

    const [products, total] = await this.products.list({
      filter: {
        categoryIds,
        brandSlugs: query.brand,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        inStock: query.inStock,
        q: query.q,
        isActive,
        lowStock,
      },
      sort: query.sort,
      skip: query.skip,
      take: query.limit,
    });
    return paginate(products.map(ProductResponseDto.from), total, query);
  }

  private assertPriceRange(query: ProductQueryDto) {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('minPrice không được lớn hơn maxPrice');
    }
  }

  private async assertReferences(categoryId?: string, brandId?: string) {
    if (categoryId && !(await this.categories.exists(categoryId))) {
      throw new BadRequestException('Danh mục không tồn tại');
    }
    if (brandId && !(await this.brands.exists(brandId))) {
      throw new BadRequestException('Thương hiệu không tồn tại');
    }
  }

  private async saveUnique(
    save: () => Promise<ProductWithRelations>,
  ): Promise<ProductWithRelations> {
    try {
      return await save();
    } catch (err) {
      const fields = uniqueViolationFields(err);
      if (fields) {
        throw new ConflictException(
          fields.some((f) => f.includes('sku'))
            ? 'SKU đã tồn tại'
            : 'Slug sản phẩm đã tồn tại',
        );
      }
      throw err;
    }
  }
}
