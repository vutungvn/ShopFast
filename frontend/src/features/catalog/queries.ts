import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { catalogApi } from './api'
import { sortCategoryTree } from './category-tree'
import type { ProductQuery } from './types'

// Danh mục, thương hiệu ít thay đổi: giữ 5 phút
const REFERENCE_STALE_TIME = 5 * 60_000

export function useProducts(query: ProductQuery) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: () => catalogApi.listProducts(query),
    // Đổi trang/bộ lọc: giữ kết quả cũ trong lúc tải, không nháy về skeleton
    placeholderData: keepPreviousData,
  })
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => catalogApi.getProduct(slug),
  })
}

export function useCategoryTree() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: catalogApi.categoryTree,
    select: sortCategoryTree,
    staleTime: REFERENCE_STALE_TIME,
  })
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: catalogApi.brands,
    staleTime: REFERENCE_STALE_TIME,
  })
}
