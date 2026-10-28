import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MAX_CART_ITEMS } from './cart.constants';
import { CartRepository, LockedCart, ProductForCart } from './cart.repository';
import { CartService } from './cart.service';

/** Giỏ giả trong bộ nhớ thay cho transaction + khoá thật */
function fakeCart(
  products: ProductForCart[],
  items: Record<string, number> = {},
) {
  const quantities = new Map(Object.entries(items));
  const locked: jest.Mocked<LockedCart> = {
    findProduct: jest.fn(
      async (id) => products.find((p) => p.id === id) ?? null,
    ),
    findQuantity: jest.fn(async (id) => quantities.get(id) ?? null),
    countItems: jest.fn(async () => quantities.size),
    setQuantity: jest.fn(async (id, quantity) => {
      quantities.set(id, quantity);
    }),
  };
  const repo = {
    findLines: jest.fn().mockResolvedValue([]),
    withLockedCart: jest.fn((_userId, work) => work(locked)),
    removeItem: jest.fn(),
    clear: jest.fn(),
  } as unknown as jest.Mocked<CartRepository>;
  return { repo, locked, quantities, service: new CartService(repo) };
}

const laptop: ProductForCart = { id: 'p1', isActive: true, stock: 10 };

describe('CartService.addItem', () => {
  it('sản phẩm mới => tạo dòng với đúng số lượng', async () => {
    const { service, quantities } = fakeCart([laptop]);
    await service.addItem('u1', 'p1', 2);
    expect(quantities.get('p1')).toBe(2);
  });

  it('sản phẩm đã có => cộng dồn', async () => {
    const { service, quantities } = fakeCart([laptop], { p1: 3 });
    await service.addItem('u1', 'p1', 4);
    expect(quantities.get('p1')).toBe(7);
  });

  it('chạy trong giỏ đã khoá của đúng user', async () => {
    const { service, repo } = fakeCart([laptop]);
    await service.addItem('u1', 'p1', 1);
    expect(repo.withLockedCart).toHaveBeenCalledWith(
      'u1',
      expect.any(Function),
    );
  });

  it.each([
    ['không tồn tại', []],
    ['đã ngừng bán', [{ ...laptop, isActive: false }]],
  ])('sản phẩm %s => 404', async (_case, products) => {
    const { service, locked } = fakeCart(products);
    await expect(service.addItem('u1', 'p1', 1)).rejects.toThrow(
      NotFoundException,
    );
    expect(locked.setQuantity).not.toHaveBeenCalled();
  });

  it('cộng dồn vượt tồn kho => 409, nêu số còn lại và số đã có trong giỏ', async () => {
    const { service, locked } = fakeCart([laptop], { p1: 8 });
    await expect(service.addItem('u1', 'p1', 3)).rejects.toThrow(
      new ConflictException('Chỉ còn 10 sản phẩm trong kho (giỏ đã có 8)'),
    );
    expect(locked.setQuantity).not.toHaveBeenCalled();
  });

  it('hết hàng => 409 "Sản phẩm đã hết hàng"', async () => {
    const { service } = fakeCart([{ ...laptop, stock: 0 }]);
    await expect(service.addItem('u1', 'p1', 1)).rejects.toThrow(
      new ConflictException('Sản phẩm đã hết hàng'),
    );
  });

  it('cộng dồn quá 99 => 400 dù kho còn nhiều', async () => {
    const { service } = fakeCart([{ ...laptop, stock: 500 }], { p1: 95 });
    await expect(service.addItem('u1', 'p1', 5)).rejects.toThrow(
      new BadRequestException('Tối đa 99 sản phẩm mỗi loại (giỏ đã có 95)'),
    );
  });

  it(`giỏ đã đủ ${MAX_CART_ITEMS} loại => 400 với sản phẩm mới`, async () => {
    const full = Object.fromEntries(
      Array.from({ length: MAX_CART_ITEMS }, (_, i) => [`x${i}`, 1]),
    );
    const { service } = fakeCart([laptop], full);
    await expect(service.addItem('u1', 'p1', 1)).rejects.toThrow(
      new BadRequestException(
        `Giỏ hàng tối đa ${MAX_CART_ITEMS} loại sản phẩm`,
      ),
    );
  });

  it(`giỏ đủ ${MAX_CART_ITEMS} loại nhưng cộng dồn sản phẩm đã có => vẫn được`, async () => {
    const full = Object.fromEntries(
      Array.from({ length: MAX_CART_ITEMS - 1 }, (_, i) => [`x${i}`, 1]),
    );
    const { service, quantities } = fakeCart([laptop], { ...full, p1: 1 });
    await service.addItem('u1', 'p1', 1);
    expect(quantities.get('p1')).toBe(2);
  });
});

describe('CartService.updateItem', () => {
  it('đặt lại số lượng (không cộng dồn)', async () => {
    const { service, quantities } = fakeCart([laptop], { p1: 5 });
    await service.updateItem('u1', 'p1', 2);
    expect(quantities.get('p1')).toBe(2);
  });

  it('sản phẩm không có trong giỏ => 404, không tạo dòng mới', async () => {
    const { service, locked } = fakeCart([laptop]);
    await expect(service.updateItem('u1', 'p1', 2)).rejects.toThrow(
      new NotFoundException('Sản phẩm không có trong giỏ'),
    );
    expect(locked.setQuantity).not.toHaveBeenCalled();
  });

  it('sản phẩm đã ngừng bán => 409, chỉ được xoá', async () => {
    const { service } = fakeCart([{ ...laptop, isActive: false }], { p1: 1 });
    await expect(service.updateItem('u1', 'p1', 2)).rejects.toThrow(
      ConflictException,
    );
  });

  it('vượt tồn kho => 409', async () => {
    const { service } = fakeCart([{ ...laptop, stock: 3 }], { p1: 1 });
    await expect(service.updateItem('u1', 'p1', 4)).rejects.toThrow(
      new ConflictException('Chỉ còn 3 sản phẩm trong kho'),
    );
  });

  it('giảm về đúng bằng tồn kho => được (gỡ cảnh báo thiếu hàng)', async () => {
    const { service, quantities } = fakeCart([{ ...laptop, stock: 3 }], {
      p1: 8,
    });
    await service.updateItem('u1', 'p1', 3);
    expect(quantities.get('p1')).toBe(3);
  });
});

describe('CartService.removeItem / clear', () => {
  it('xoá sản phẩm không có trong giỏ => 404', async () => {
    const { service, repo } = fakeCart([laptop]);
    repo.removeItem.mockResolvedValue(0);
    await expect(service.removeItem('u1', 'p1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('xoá hết giỏ trả về giỏ rỗng', async () => {
    const { service, repo } = fakeCart([laptop]);
    const view = await service.clear('u1');
    expect(repo.clear).toHaveBeenCalledWith('u1');
    expect(view.items).toEqual([]);
  });
});
