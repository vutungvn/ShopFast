import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Brand } from '@prisma/client';
import { uniqueViolationFields } from '../../common/prisma/prisma-errors';
import { slugify } from '../../common/utils/slug';
import { CacheService } from '../../infra/cache/cache.service';
import { ProductCacheService } from '../products/product-cache.service';
import { BrandsRepository } from './brands.repository';
import { BrandDto } from './dto/brand-response.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

const LIST_KEY = 'brand:list';
const LIST_TTL = 3600;

@Injectable()
export class BrandsService {
  constructor(
    private readonly brands: BrandsRepository,
    private readonly cache: CacheService,
    private readonly productCache: ProductCacheService,
  ) {}

  async list(): Promise<BrandDto[]> {
    const { value } = await this.cache.getOrSet(
      LIST_KEY,
      { group: 'brand', ttl: LIST_TTL },
      () => this.brands.findAll(),
    );
    return value;
  }

  async exists(id: string): Promise<boolean> {
    return (await this.brands.findById(id)) !== null;
  }

  async create(dto: CreateBrandDto): Promise<BrandDto> {
    const slug = dto.slug ?? slugify(dto.name);
    if (!slug) {
      throw new BadRequestException(
        'Không tạo được slug từ tên, vui lòng nhập slug',
      );
    }
    const brand = await this.saveUnique(() =>
      this.brands.create({ name: dto.name, slug }),
    );
    await this.cache.delete(LIST_KEY);
    return brand;
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandDto> {
    await this.getOrThrow(id);
    const brand = await this.saveUnique(() =>
      this.brands.update(id, { name: dto.name, slug: dto.slug }),
    );
    // Sản phẩm cache kèm tên/slug thương hiệu
    await Promise.all([
      this.cache.delete(LIST_KEY),
      this.productCache.invalidateByBrand(id),
    ]);
    return brand;
  }

  /** Chỉ xoá được thương hiệu chưa có sản phẩm nào. */
  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    if ((await this.brands.countProducts(id)) > 0) {
      throw new ConflictException('Thương hiệu còn sản phẩm, không thể xoá');
    }
    await this.brands.delete(id);
    await this.cache.delete(LIST_KEY);
  }

  private async getOrThrow(id: string): Promise<Brand> {
    const brand = await this.brands.findById(id);
    if (!brand) throw new NotFoundException('Không tìm thấy thương hiệu');
    return brand;
  }

  private async saveUnique(save: () => Promise<Brand>): Promise<Brand> {
    try {
      return await save();
    } catch (err) {
      if (uniqueViolationFields(err)) {
        throw new ConflictException('Slug thương hiệu đã tồn tại');
      }
      throw err;
    }
  }
}
