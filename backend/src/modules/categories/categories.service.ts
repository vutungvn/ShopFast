import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category } from '@prisma/client';
import { uniqueViolationFields } from '../../common/prisma/prisma-errors';
import { slugify } from '../../common/utils/slug';
import { CacheService } from '../../infra/cache/cache.service';
import { ProductCacheService } from '../products/product-cache.service';
import { CategoriesRepository } from './categories.repository';
import { buildCategoryTree, collectDescendantIds } from './category-tree';
import { CategoryDto, CategoryNodeDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/** Cây danh mục hiện trên mọi trang, ít khi đổi và luôn được xoá ngay khi admin sửa */
const TREE_KEY = 'cat:tree';
const TREE_TTL = 3600;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categories: CategoriesRepository,
    private readonly cache: CacheService,
    private readonly productCache: ProductCacheService,
  ) {}

  async tree(): Promise<CategoryNodeDto[]> {
    const { value } = await this.cache.getOrSet(
      TREE_KEY,
      { group: 'cat', ttl: TREE_TTL },
      async () => buildCategoryTree(await this.categories.findAll()),
    );
    return value;
  }

  /**
   * id của danh mục theo slug cùng mọi danh mục con cháu.
   * Trả null nếu slug không tồn tại.
   */
  async findIdsWithDescendants(slug: string): Promise<string[] | null> {
    const all = await this.categories.findAll();
    const root = all.find((c) => c.slug === slug);
    return root ? collectDescendantIds(all, root.id) : null;
  }

  async exists(id: string): Promise<boolean> {
    return (await this.categories.findById(id)) !== null;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const slug = dto.slug ?? slugify(dto.name);
    if (!slug) {
      throw new BadRequestException(
        'Không tạo được slug từ tên, vui lòng nhập slug',
      );
    }
    if (dto.parentId && !(await this.exists(dto.parentId))) {
      throw new BadRequestException('Danh mục cha không tồn tại');
    }
    const category = await this.saveUnique(() =>
      this.categories.create({
        name: dto.name,
        slug,
        parentId: dto.parentId,
      }),
    );
    await this.cache.delete(TREE_KEY);
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    await this.getOrThrow(id);
    if (dto.parentId) await this.assertValidParent(id, dto.parentId);
    const category = await this.saveUnique(() =>
      this.categories.update(id, {
        name: dto.name,
        slug: dto.slug,
        parentId: dto.parentId,
      }),
    );
    // Sản phẩm cache kèm tên/slug danh mục; đổi cha thì lọc theo danh mục cha cũng đổi kết quả
    await Promise.all([
      this.cache.delete(TREE_KEY),
      this.productCache.invalidateByCategory(id),
    ]);
    return category;
  }

  /** Chỉ xoá được danh mục rỗng: không còn danh mục con và không còn sản phẩm. */
  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    if ((await this.categories.countChildren(id)) > 0) {
      throw new ConflictException('Danh mục còn danh mục con, không thể xoá');
    }
    if ((await this.categories.countProducts(id)) > 0) {
      throw new ConflictException('Danh mục còn sản phẩm, không thể xoá');
    }
    await this.categories.delete(id);
    await this.cache.delete(TREE_KEY);
  }

  private async getOrThrow(id: string): Promise<Category> {
    const category = await this.categories.findById(id);
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');
    return category;
  }

  /** Chặn vòng lặp trong cây: không được chọn chính nó hoặc con cháu của nó làm cha. */
  private async assertValidParent(id: string, parentId: string) {
    const all = await this.categories.findAll();
    if (!all.some((c) => c.id === parentId)) {
      throw new BadRequestException('Danh mục cha không tồn tại');
    }
    if (collectDescendantIds(all, id).includes(parentId)) {
      throw new BadRequestException(
        'Không thể chuyển danh mục vào chính nó hoặc danh mục con của nó',
      );
    }
  }

  private async saveUnique(save: () => Promise<Category>): Promise<Category> {
    try {
      return await save();
    } catch (err) {
      if (uniqueViolationFields(err)) {
        throw new ConflictException('Slug danh mục đã tồn tại');
      }
      throw err;
    }
  }
}
