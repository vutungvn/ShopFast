import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { BrandsService } from '../brands/brands.service';
import { CategoriesService } from '../categories/categories.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto, ProductSort } from './dto/product-query.dto';
import {
  ProductsRepository,
  ProductWithRelations,
} from './products.repository';
import { ProductsService } from './products.service';

const product: ProductWithRelations = {
  id: 'p1',
  sku: 'SS-S24',
  name: 'Samsung Galaxy S24',
  slug: 'samsung-galaxy-s24',
  description: null,
  price: new Prisma.Decimal('22990000.00'),
  isActive: true,
  categoryId: 'c1',
  brandId: 'b1',
  createdAt: new Date(),
  updatedAt: new Date(),
  category: {
    id: 'c1',
    name: 'Điện thoại',
    slug: 'dien-thoai',
    parentId: null,
  },
  brand: { id: 'b1', name: 'Samsung', slug: 'samsung' },
  inventory: { stock: 7 },
};

const query = (plain: Record<string, unknown> = {}) =>
  plainToInstance(ProductQueryDto, plain);

const createDto: CreateProductDto = {
  sku: 'SS-S24',
  name: 'Samsung Galaxy S24',
  price: 22990000,
  categoryId: 'c1',
  brandId: 'b1',
  stock: 10,
  isActive: true,
};

describe('ProductsService', () => {
  let repo: jest.Mocked<ProductsRepository>;
  let categories: jest.Mocked<
    Pick<CategoriesService, 'findIdsWithDescendants' | 'exists'>
  >;
  let brands: jest.Mocked<Pick<BrandsService, 'exists'>>;
  let service: ProductsService;

  beforeEach(() => {
    repo = {
      list: jest.fn().mockResolvedValue([[product], 1]),
      findById: jest.fn().mockResolvedValue(product),
      findBySlug: jest.fn().mockResolvedValue(product),
      create: jest.fn().mockResolvedValue(product),
      update: jest.fn().mockResolvedValue(product),
      setStock: jest.fn(),
      adjustStock: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as jest.Mocked<ProductsRepository>;
    categories = {
      findIdsWithDescendants: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
    };
    brands = { exists: jest.fn().mockResolvedValue(true) };
    service = new ProductsService(
      repo,
      categories as unknown as CategoriesService,
      brands as unknown as BrandsService,
    );
  });

  describe('listPublic', () => {
    it('chỉ lấy sản phẩm đang bán, mặc định trang 1, 20 bản ghi, mới nhất trước', async () => {
      const res = await service.listPublic(query());
      expect(repo.list).toHaveBeenCalledWith({
        filter: expect.objectContaining({ isActive: true }),
        sort: ProductSort.NEWEST,
        skip: 0,
        take: 20,
      });
      expect(res.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('trả giá dạng number và tồn kho', async () => {
      const res = await service.listPublic(query());
      expect(res.items[0]).toMatchObject({ price: 22990000, stock: 7 });
    });

    it('lọc theo danh mục cha => truyền id của cả danh mục con', async () => {
      categories.findIdsWithDescendants.mockResolvedValue(['c0', 'c1', 'c2']);
      await service.listPublic(query({ category: 'dien-tu' }));
      expect(repo.list).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ categoryIds: ['c0', 'c1', 'c2'] }),
        }),
      );
    });

    it('danh mục không tồn tại => danh sách rỗng, không truy vấn sản phẩm', async () => {
      categories.findIdsWithDescendants.mockResolvedValue(null);
      const res = await service.listPublic(
        query({ category: 'khong-co', page: '2', limit: '5' }),
      );
      expect(res).toEqual({
        items: [],
        meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
      });
      expect(repo.list).not.toHaveBeenCalled();
    });

    it('minPrice > maxPrice => 400', async () => {
      await expect(
        service.listPublic(query({ minPrice: '500', maxPrice: '100' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('chuyển đủ bộ lọc và tính skip theo trang', async () => {
      await service.listPublic(
        query({
          brand: 'apple,samsung',
          minPrice: '100',
          maxPrice: '500',
          inStock: 'true',
          q: '  galaxy ',
          sort: 'price_asc',
          page: '3',
          limit: '10',
        }),
      );
      expect(repo.list).toHaveBeenCalledWith({
        filter: {
          categoryIds: undefined,
          brandSlugs: ['apple', 'samsung'],
          minPrice: 100,
          maxPrice: 500,
          inStock: true,
          q: 'galaxy',
          isActive: true,
        },
        sort: ProductSort.PRICE_ASC,
        skip: 20,
        take: 10,
      });
    });
  });

  it('listForStaff không ép isActive khi không lọc', async () => {
    await service.listForStaff(query());
    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ isActive: undefined }),
      }),
    );
  });

  describe('getBySlug', () => {
    it('không tồn tại => 404', async () => {
      repo.findBySlug.mockResolvedValue(null);
      await expect(service.getBySlug('x')).rejects.toThrow(NotFoundException);
    });

    it('đã ngừng bán => 404 với khách', async () => {
      repo.findBySlug.mockResolvedValue({ ...product, isActive: false });
      await expect(service.getBySlug(product.slug)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('tự sinh slug từ tên và tạo kèm tồn kho', async () => {
      await service.create({ ...createDto, name: 'Nồi cơm điện Sharp 1.8L' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'noi-com-dien-sharp-1-8l' }),
        10,
      );
    });

    it('danh mục không tồn tại => 400', async () => {
      categories.exists.mockResolvedValue(false);
      await expect(service.create(createDto)).rejects.toThrow(
        'Danh mục không tồn tại',
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('thương hiệu không tồn tại => 400', async () => {
      brands.exists.mockResolvedValue(false);
      await expect(service.create(createDto)).rejects.toThrow(
        'Thương hiệu không tồn tại',
      );
    });

    it.each([
      [['sku'], 'SKU đã tồn tại'],
      [['slug'], 'Slug sản phẩm đã tồn tại'],
    ])('trùng %j => 409 "%s"', async (target, message) => {
      repo.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target },
        }),
      );
      const err = service.create(createDto);
      await expect(err).rejects.toThrow(ConflictException);
      await expect(err).rejects.toThrow(message);
    });
  });

  describe('update', () => {
    it('sản phẩm không tồn tại => 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('p404', { price: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('chỉ kiểm tra danh mục/thương hiệu khi có gửi lên', async () => {
      await service.update('p1', { price: 19990000 });
      expect(categories.exists).not.toHaveBeenCalled();
      expect(brands.exists).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ price: 19990000, name: undefined }),
      );
    });
  });

  describe('updateInventory', () => {
    it.each([
      { name: 'không gửi gì', dto: {} },
      { name: 'gửi cả hai', dto: { stock: 5, delta: 1 } },
    ])('$name => 400, không đụng tới tồn kho', async ({ dto }) => {
      await expect(service.updateInventory('p1', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.setStock).not.toHaveBeenCalled();
      expect(repo.adjustStock).not.toHaveBeenCalled();
    });

    it('sản phẩm không tồn tại => 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.updateInventory('p404', { stock: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('stock => đặt lại số tồn, trả sản phẩm sau khi đổi', async () => {
      const res = await service.updateInventory('p1', { stock: 0 });
      expect(repo.setStock).toHaveBeenCalledWith('p1', 0);
      expect(res.id).toBe('p1');
    });

    it('delta => cộng/trừ nguyên tử', async () => {
      await service.updateInventory('p1', { delta: -3 });
      expect(repo.adjustStock).toHaveBeenCalledWith('p1', -3);
    });

    it('trừ quá số đang có => 409 nêu số còn lại', async () => {
      repo.adjustStock.mockResolvedValue({ ok: false, stock: 2 });
      const err = service.updateInventory('p1', { delta: -5 });
      await expect(err).rejects.toThrow(ConflictException);
      await expect(err).rejects.toThrow('Không đủ tồn kho để trừ 5 (còn 2)');
    });
  });
});
