import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';
import { buildCategoryTree, collectDescendantIds } from './category-tree';

// dien-tu ─┬─ dien-thoai ── android
//          └─ laptop
// thoi-trang
const cat = (id: string, parentId: string | null = null): Category => ({
  id,
  name: id,
  slug: id,
  parentId,
});
const all = [
  cat('dien-tu'),
  cat('dien-thoai', 'dien-tu'),
  cat('android', 'dien-thoai'),
  cat('laptop', 'dien-tu'),
  cat('thoi-trang'),
];

describe('category-tree', () => {
  it('dựng cây lồng nhau từ danh sách phẳng', () => {
    const tree = buildCategoryTree(all);
    expect(tree.map((n) => n.slug)).toEqual(['dien-tu', 'thoi-trang']);
    const dienTu = tree[0];
    expect(dienTu.children.map((n) => n.slug)).toEqual([
      'dien-thoai',
      'laptop',
    ]);
    expect(dienTu.children[0].children[0].slug).toBe('android');
  });

  it('lấy danh mục cùng mọi con cháu', () => {
    expect(collectDescendantIds(all, 'dien-tu').sort()).toEqual(
      ['android', 'dien-thoai', 'dien-tu', 'laptop'].sort(),
    );
    expect(collectDescendantIds(all, 'laptop')).toEqual(['laptop']);
  });
});

describe('CategoriesService', () => {
  let repo: jest.Mocked<CategoriesRepository>;
  let service: CategoriesService;

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue(all),
      findById: jest.fn(
        async (id: string) => all.find((c) => c.id === id) ?? null,
      ),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countChildren: jest.fn().mockResolvedValue(0),
      countProducts: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<CategoriesRepository>;
    service = new CategoriesService(repo);
  });

  it('findIdsWithDescendants: slug không tồn tại => null', async () => {
    expect(await service.findIdsWithDescendants('khong-co')).toBeNull();
  });

  it('tạo danh mục không nhập slug => tự sinh từ tên tiếng Việt', async () => {
    repo.create.mockImplementation(async (data) => data as Category);
    await service.create({ name: 'Máy tính bảng' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'may-tinh-bang' }),
    );
  });

  it('tạo với danh mục cha không tồn tại => 400', async () => {
    await expect(
      service.create({ name: 'X', parentId: 'khong-co' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('slug trùng (P2002) => 409', async () => {
    repo.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['slug'] },
      }),
    );
    await expect(service.create({ name: 'Laptop' })).rejects.toThrow(
      ConflictException,
    );
  });

  it.each([
    ['chính nó', 'dien-tu'],
    ['con trực tiếp', 'dien-thoai'],
    ['cháu', 'android'],
  ])('chuyển danh mục vào %s => 400 (chặn vòng lặp)', async (_c, parentId) => {
    await expect(service.update('dien-tu', { parentId })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('chuyển sang nhánh khác hợp lệ', async () => {
    await service.update('laptop', { parentId: 'thoi-trang' });
    expect(repo.update).toHaveBeenCalledWith(
      'laptop',
      expect.objectContaining({ parentId: 'thoi-trang' }),
    );
  });

  it('parentId = null => thành danh mục gốc', async () => {
    await service.update('laptop', { parentId: null });
    expect(repo.update).toHaveBeenCalledWith(
      'laptop',
      expect.objectContaining({ parentId: null }),
    );
  });

  it('sửa danh mục không tồn tại => 404', async () => {
    await expect(service.update('khong-co', { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('xoá danh mục còn danh mục con => 409', async () => {
    repo.countChildren.mockResolvedValue(2);
    await expect(service.remove('dien-tu')).rejects.toThrow(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('xoá danh mục còn sản phẩm => 409', async () => {
    repo.countProducts.mockResolvedValue(5);
    await expect(service.remove('laptop')).rejects.toThrow(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('xoá danh mục rỗng', async () => {
    await service.remove('laptop');
    expect(repo.delete).toHaveBeenCalledWith('laptop');
  });
});
