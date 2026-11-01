import { ConflictException, NotFoundException } from '@nestjs/common';
import { Brand, Prisma } from '@prisma/client';
import { CacheService } from '../../infra/cache/cache.service';
import { ProductCacheService } from '../products/product-cache.service';
import { BrandsRepository } from './brands.repository';
import { BrandsService } from './brands.service';

const samsung: Brand = { id: 'b1', name: 'Samsung', slug: 'samsung' };

describe('BrandsService', () => {
  let repo: jest.Mocked<BrandsRepository>;
  let cache: jest.Mocked<CacheService>;
  let productCache: jest.Mocked<ProductCacheService>;
  let service: BrandsService;

  beforeEach(() => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn().mockResolvedValue(samsung),
      create: jest.fn(async (data) => ({ id: 'new', ...data }) as Brand),
      update: jest.fn(),
      delete: jest.fn(),
      countProducts: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<BrandsRepository>;
    cache = {
      getOrSet: jest.fn((_key, _options, load) =>
        load().then((value: unknown) => ({ value, status: 'MISS' })),
      ),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;
    productCache = {
      invalidateByCategory: jest.fn(),
      invalidateByBrand: jest.fn(),
    } as unknown as jest.Mocked<ProductCacheService>;
    service = new BrandsService(repo, cache, productCache);
  });

  it('tạo không nhập slug => tự sinh từ tên', async () => {
    const res = await service.create({ name: 'Bách Hoá Xanh' });
    expect(res.slug).toBe('bach-hoa-xanh');
  });

  it('slug trùng => 409', async () => {
    repo.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['slug'] },
      }),
    );
    await expect(service.create({ name: 'Samsung' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('xoá thương hiệu còn sản phẩm => 409', async () => {
    repo.countProducts.mockResolvedValue(3);
    await expect(service.remove('b1')).rejects.toThrow(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('xoá thương hiệu không tồn tại => 404', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.remove('b404')).rejects.toThrow(NotFoundException);
  });

  describe('cache', () => {
    it('danh sách đọc qua cache khoá brand:list', async () => {
      repo.findAll.mockResolvedValue([samsung]);
      expect(await service.list()).toEqual([samsung]);
      expect(cache.getOrSet).toHaveBeenCalledWith(
        'brand:list',
        { group: 'brand', ttl: 3600 },
        expect.any(Function),
      );
    });

    it('tạo / xoá => xoá cache danh sách', async () => {
      await service.create({ name: 'Bách Hoá Xanh' });
      await service.remove('b1');
      expect(cache.delete.mock.calls).toEqual([['brand:list'], ['brand:list']]);
    });

    it('sửa => xoá cache danh sách và làm mới sản phẩm thuộc thương hiệu', async () => {
      repo.update.mockResolvedValue(samsung);
      await service.update('b1', { name: 'Samsung VN' });
      expect(cache.delete).toHaveBeenCalledWith('brand:list');
      expect(productCache.invalidateByBrand).toHaveBeenCalledWith('b1');
    });
  });
});
