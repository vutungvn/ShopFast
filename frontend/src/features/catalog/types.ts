/** Khớp CategoryDto / CategoryNodeDto của backend */
export type Category = {
  id: string
  name: string
  slug: string
  parentId: string | null
}

export type CategoryNode = Category & { children: CategoryNode[] }

export type Brand = {
  id: string
  name: string
  slug: string
}

/** Khớp ProductResponseDto của backend */
export type Product = {
  id: string
  sku: string
  name: string
  slug: string
  description: string | null
  /** Ảnh chính (/images/... hoặc https); null => hiện icon theo danh mục */
  imageUrl: string | null
  /** VND */
  price: number
  isActive: boolean
  stock: number
  category: Category
  brand: Brand
  createdAt: string
  updatedAt: string
}

export type Paginated<T> = {
  items: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc', 'name_asc'] as const
export type ProductSort = (typeof PRODUCT_SORTS)[number]

export const SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Mới nhất',
  price_asc: 'Giá thấp đến cao',
  price_desc: 'Giá cao đến thấp',
  name_asc: 'Tên A–Z',
}

/** Tham số GET /products (khớp ProductQueryDto) */
export type ProductQuery = {
  category?: string
  brand?: string[]
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  q?: string
  sort?: ProductSort
  page?: number
  limit?: number
}
