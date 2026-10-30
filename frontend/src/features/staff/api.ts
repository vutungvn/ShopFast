import { http } from '@/api/client'
import type { Paginated, Product, ProductSort } from '@/features/catalog/types'

/** Khớp MAX_STOCK của backend */
export const MAX_STOCK = 1_000_000

/** Tham số GET /products/manage (khớp ManageProductQueryDto) */
export type ManageProductQuery = {
  q?: string
  category?: string
  brand?: string
  inStock?: boolean
  lowStock?: boolean
  /** Bỏ trống => cả sản phẩm ngừng bán */
  isActive?: boolean
  sort?: ProductSort
  page?: number
  limit?: number
}

export type InventoryStats = {
  total: number
  lowStock: number
  outOfStock: number
  inactive: number
}

export const inventoryApi = {
  list: (query: ManageProductQuery) =>
    http.get<Paginated<Product>>('/products/manage', { params: query }).then((res) => res.data),

  stats: () => http.get<InventoryStats>('/products/manage/stats').then((res) => res.data),

  /** Gửi đúng một trong hai: `stock` (đặt lại) hoặc `delta` (cộng/trừ, trừ quá => 409) */
  update: (productId: string, change: { stock: number } | { delta: number }) =>
    http.patch<Product>(`/products/${productId}/inventory`, change).then((res) => res.data),
}
