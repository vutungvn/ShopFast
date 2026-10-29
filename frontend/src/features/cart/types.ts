import type { Product } from '@/features/catalog/types'

/**
 * Vấn đề của một dòng trong giỏ (khớp CartIssue của backend):
 * INACTIVE – ngừng bán; OUT_OF_STOCK – hết hàng; INSUFFICIENT_STOCK – kho ít hơn số lượng trong giỏ.
 */
export type CartIssue = 'INACTIVE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK'

/** Khớp CartItemResponseDto của backend */
export type CartItem = {
  /** Giá và tồn kho là giá trị hiện tại (giỏ không lưu giá) */
  product: Product
  quantity: number
  /** Đơn giá hiện tại × số lượng (VND) */
  lineTotal: number
  issue: CartIssue | null
}

/** Khớp CartResponseDto của backend */
export type Cart = {
  /** Thêm sau đứng trước */
  items: CartItem[]
  /** Số loại sản phẩm (mọi dòng), dùng cho số đếm trên icon giỏ */
  itemCount: number
  /** Tổng số lượng của các dòng được tính tiền (không có issue) */
  totalQuantity: number
  /** Tạm tính, chỉ cộng các dòng không có issue (VND) */
  subtotal: number
  /** Có ít nhất 1 dòng và không dòng nào có issue */
  canCheckout: boolean
}
