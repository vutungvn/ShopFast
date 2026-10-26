import { ConflictException, NotFoundException } from '@nestjs/common';
import { Brand, Prisma } from '@prisma/client';
import { BrandsRepository } from './brands.repository';
import { BrandsService } from './brands.service';

const samsung: Brand = { id: 'b1', name: 'Samsung', slug: 'samsung' };

describe('BrandsService', () => {
  let repo: jest.Mocked<BrandsRepository>;
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
    service = new BrandsService(repo);
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
});
