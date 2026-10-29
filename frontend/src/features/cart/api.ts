import { http } from '@/api/client'
import type { Cart } from './types'

/** Mọi thao tác đều trả về toàn bộ giỏ sau khi đổi */
export const cartApi = {
  get: () => http.get<Cart>('/cart').then((res) => res.data),

  /** Sản phẩm đã có trong giỏ thì cộng dồn số lượng */
  addItem: (productId: string, quantity: number) =>
    http.post<Cart>('/cart/items', { productId, quantity }).then((res) => res.data),

  /** Đặt lại số lượng (không cộng dồn) */
  updateItem: (productId: string, quantity: number) =>
    http.patch<Cart>(`/cart/items/${productId}`, { quantity }).then((res) => res.data),

  removeItem: (productId: string) => http.delete<Cart>(`/cart/items/${productId}`).then((res) => res.data),

  clear: () => http.delete<Cart>('/cart').then((res) => res.data),
}
