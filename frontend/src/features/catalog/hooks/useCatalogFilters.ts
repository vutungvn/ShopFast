import { useSearchParams } from 'react-router'
import { PRODUCT_SORTS, type ProductQuery, type ProductSort } from '../types'

export const PAGE_SIZE = 20

export type CatalogFilters = {
  category?: string
  brands: string[]
  minPrice?: number
  maxPrice?: number
  inStock: boolean
  q?: string
  sort: ProductSort
  page: number
}

function parseAmount(value: string | null) {
  if (!value) return undefined
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined
}

/** URL có thể bị sửa tay: bỏ giá trị không hợp lệ thay vì gửi lên để nhận 400 */
function parseFilters(params: URLSearchParams): CatalogFilters {
  let minPrice = parseAmount(params.get('minPrice'))
  let maxPrice = parseAmount(params.get('maxPrice'))
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    ;[minPrice, maxPrice] = [maxPrice, minPrice]
  }
  const sort = params.get('sort') as ProductSort | null
  const page = Number(params.get('page'))
  return {
    category: params.get('category') || undefined,
    brands: (params.get('brand') ?? '').split(',').filter(Boolean),
    minPrice,
    maxPrice,
    inStock: params.get('inStock') === 'true',
    q: params.get('q')?.trim() || undefined,
    sort: sort && PRODUCT_SORTS.includes(sort) ? sort : 'newest',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

/** Chỉ ghi giá trị khác mặc định để URL gọn */
function toSearchParams(filters: CatalogFilters) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.category) params.set('category', filters.category)
  if (filters.brands.length) params.set('brand', filters.brands.join(','))
  if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice))
  if (filters.inStock) params.set('inStock', 'true')
  if (filters.sort !== 'newest') params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))
  return params
}

/**
 * Bộ lọc danh mục lưu trên URL (?category=laptop&brand=apple,dell&page=2):
 * chia sẻ link, nút Back và F5 đều giữ đúng bộ lọc.
 */
export function useCatalogFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseFilters(searchParams)

  /** Đổi bộ lọc thì quay về trang 1, trừ khi chính là đổi trang */
  const update = (patch: Partial<CatalogFilters>) =>
    setSearchParams(toSearchParams({ ...filters, page: 1, ...patch }))

  /** Xoá mọi bộ lọc, giữ từ khoá tìm kiếm và cách sắp xếp */
  const clearFilters = () =>
    setSearchParams(
      toSearchParams({ brands: [], inStock: false, q: filters.q, sort: filters.sort, page: 1 }),
    )

  const query: ProductQuery = {
    category: filters.category,
    brand: filters.brands,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: filters.inStock || undefined,
    q: filters.q,
    sort: filters.sort,
    page: filters.page,
    limit: PAGE_SIZE,
  }

  const activeCount =
    (filters.category ? 1 : 0) +
    filters.brands.length +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    (filters.inStock ? 1 : 0)

  return { filters, query, update, clearFilters, activeCount }
}
