import { http } from '@/api/client'
import type { Brand, CategoryNode, Paginated, Product, ProductQuery } from './types'

export const catalogApi = {
  listProducts: ({ brand, ...query }: ProductQuery) =>
    http
      .get<Paginated<Product>>('/products', {
        // axios mặc định gửi mảng dạng brand[]=a; backend nhận brand=a,b
        params: { ...query, brand: brand?.length ? brand.join(',') : undefined },
      })
      .then((res) => res.data),

  getProduct: (slug: string) =>
    http.get<Product>(`/products/${encodeURIComponent(slug)}`).then((res) => res.data),

  categoryTree: () => http.get<CategoryNode[]>('/categories').then((res) => res.data),

  brands: () => http.get<Brand[]>('/brands').then((res) => res.data),
}
