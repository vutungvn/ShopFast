import { Prisma } from '@prisma/client';
import { ProductWithRelations } from '../products/products.repository';
import { buildCartView, lineIssue } from './cart-view';
import { CartIssue } from './dto/cart-response.dto';

const product = (
  id: string,
  price: string,
  stock: number,
  isActive = true,
): ProductWithRelations => ({
  id,
  sku: `SKU-${id}`,
  name: `Sản phẩm ${id}`,
  slug: `san-pham-${id}`,
  description: null,
  imageUrl: null,
  price: new Prisma.Decimal(price),
  isActive,
  categoryId: 'c1',
  brandId: 'b1',
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { id: 'c1', name: 'Laptop', slug: 'laptop', parentId: null },
  brand: { id: 'b1', name: 'HP', slug: 'hp' },
  inventory: { stock },
});

describe('lineIssue', () => {
  it.each([
    ['đang bán, đủ hàng', true, 10, 3, null],
    ['đúng bằng tồn kho', true, 3, 3, null],
    ['ngừng bán (ưu tiên hơn hết hàng)', false, 0, 1, CartIssue.INACTIVE],
    ['hết hàng', true, 0, 1, CartIssue.OUT_OF_STOCK],
    ['kho ít hơn số lượng trong giỏ', true, 2, 5, CartIssue.INSUFFICIENT_STOCK],
  ])('%s', (_case, isActive, stock, quantity, expected) => {
    expect(lineIssue(isActive, stock, quantity)).toBe(expected);
  });
});

describe('buildCartView', () => {
  it('giỏ rỗng: không đặt hàng được', () => {
    expect(buildCartView([])).toEqual({
      items: [],
      itemCount: 0,
      totalQuantity: 0,
      subtotal: 0,
      canCheckout: false,
    });
  });

  it('tính thành tiền, tạm tính và giữ đúng thứ tự dòng', () => {
    const view = buildCartView([
      { product: product('a', '22990000', 10), quantity: 2 },
      { product: product('b', '1500000', 5), quantity: 1 },
    ]);
    expect(view.items.map((i) => i.lineTotal)).toEqual([45980000, 1500000]);
    expect(view).toMatchObject({
      itemCount: 2,
      totalQuantity: 3,
      subtotal: 47480000,
      canCheckout: true,
    });
  });

  it('dòng có vấn đề không tính vào tạm tính và chặn đặt hàng, nhưng vẫn được đếm', () => {
    const view = buildCartView([
      { product: product('ok', '100000', 10), quantity: 2 },
      { product: product('off', '999000', 10, false), quantity: 1 },
      { product: product('low', '50000', 1), quantity: 3 },
    ]);
    expect(view.items.map((i) => i.issue)).toEqual([
      null,
      CartIssue.INACTIVE,
      CartIssue.INSUFFICIENT_STOCK,
    ]);
    expect(view).toMatchObject({
      itemCount: 3,
      totalQuantity: 2,
      subtotal: 200000,
      canCheckout: false,
    });
  });

  it('tính tiền chính xác với giá có phần lẻ (không sai số dấu phẩy động)', () => {
    const view = buildCartView([
      { product: product('x', '0.10', 99), quantity: 3 },
      { product: product('y', '0.20', 99), quantity: 1 },
    ]);
    expect(view.items[0].lineTotal).toBe(0.3);
    expect(view.subtotal).toBe(0.5);
  });

  it('sản phẩm trả về có giá dạng number và tồn kho hiện tại', () => {
    const view = buildCartView([
      { product: product('a', '22990000', 7), quantity: 1 },
    ]);
    expect(view.items[0].product).toMatchObject({
      price: 22990000,
      stock: 7,
    });
  });
});
