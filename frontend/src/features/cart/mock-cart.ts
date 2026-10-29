/**
 * TẠM THỜI: dữ liệu giỏ giả để dựng UI khi chưa ghép API.
 * Ghép API xong thì xoá file này, thay useMockCart bằng query/mutation gọi /cart.
 */
import { useState } from 'react'
import type { Product } from '@/features/catalog/types'
import type { Cart, CartIssue } from './types'

type MockLine = { product: Product; quantity: number }

function mockProduct(
  id: number,
  name: string,
  brand: string,
  category: { name: string; slug: string },
  price: number,
  stock: number,
  isActive = true,
): Product {
  const code = String(id).padStart(5, '0')
  return {
    id: `00000000-0000-4000-8000-0000000${code}`,
    sku: `SF-${code}`,
    name,
    slug: `mock-${code}`,
    description: null,
    price,
    isActive,
    stock,
    category: { id: category.slug, ...category, parentId: null },
    brand: { id: brand, name: brand, slug: brand.toLowerCase() },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  }
}

const PHONE = { name: 'Điện thoại', slug: 'dien-thoai' }
const HEADPHONES = { name: 'Tai nghe', slug: 'tai-nghe' }

// Đủ mọi trạng thái của một dòng: bình thường, sắp hết, vượt tồn kho, hết hàng, ngừng bán
const INITIAL_LINES: MockLine[] = [
  { product: mockProduct(1, 'iPhone 15 Pro Max 256GB', 'Apple', PHONE, 29_990_000, 24), quantity: 1 },
  { product: mockProduct(8, 'Galaxy Buds2 Pro', 'Samsung', HEADPHONES, 3_990_000, 3), quantity: 2 },
  { product: mockProduct(15, 'Tai nghe Sony WH-1000XM5', 'Sony', HEADPHONES, 8_490_000, 2), quantity: 4 },
  {
    product: mockProduct(22, 'Nồi chiên không dầu Xiaomi 6L', 'Xiaomi', { name: 'Nồi chiên không dầu', slug: 'noi-chien-khong-dau' }, 1_890_000, 0),
    quantity: 1,
  },
  {
    product: mockProduct(31, 'Giày Nike Air Zoom Pegasus 40', 'Nike', { name: 'Giày thể thao', slug: 'giay-the-thao' }, 3_519_000, 12, false),
    quantity: 1,
  },
]

function lineIssue({ product, quantity }: MockLine): CartIssue | null {
  if (!product.isActive) return 'INACTIVE'
  if (product.stock <= 0) return 'OUT_OF_STOCK'
  if (product.stock < quantity) return 'INSUFFICIENT_STOCK'
  return null
}

/** Dựng giỏ giống buildCartView của backend */
function buildCart(lines: MockLine[]): Cart {
  const items = lines.map((line) => ({
    ...line,
    lineTotal: line.product.price * line.quantity,
    issue: lineIssue(line),
  }))
  const counted = items.filter((item) => !item.issue)
  return {
    items,
    itemCount: items.length,
    totalQuantity: counted.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: counted.reduce((sum, item) => sum + item.lineTotal, 0),
    canCheckout: items.length > 0 && items.every((item) => !item.issue),
  }
}

export function useMockCart() {
  const [lines, setLines] = useState(INITIAL_LINES)

  return {
    cart: buildCart(lines),
    updateQuantity: (productId: string, quantity: number) =>
      setLines((prev) => prev.map((line) => (line.product.id === productId ? { ...line, quantity } : line))),
    removeItem: (productId: string) => setLines((prev) => prev.filter((line) => line.product.id !== productId)),
    clear: () => setLines([]),
  }
}
