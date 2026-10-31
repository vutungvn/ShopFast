import type { Role } from '@/features/auth/types'

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
  'PACKING',
  'SHIPPING',
  'DELIVERED',
  'CANCELLED',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Khớp OrderItemResponseDto: tên và đơn giá là của lúc đặt */
export type OrderItem = {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  lineTotal: number
  /** Ảnh hiện tại của sản phẩm */
  productImageUrl: string | null
}

/** Khớp OrderResponseDto (đặt đơn, thanh toán, huỷ) */
export type Order = {
  id: string
  code: string
  status: OrderStatus
  recipientName: string
  recipientPhone: string
  shippingAddress: string
  items: OrderItem[]
  subtotal: number
  shippingFee: number
  totalAmount: number
  paidAt: string | null
  cancelledAt: string | null
  createdAt: string
}

/** Những gì khách làm được với đơn ngay lúc này (backend tính) */
export type CustomerActions = {
  /** Hạn thanh toán; chỉ có khi đơn đang chờ thanh toán */
  paymentDueAt: string | null
  canPay: boolean
  canCancel: boolean
}

/** Khớp OrderSummaryDto: một thẻ trong danh sách "Đơn mua" */
export type OrderSummary = CustomerActions & {
  id: string
  code: string
  status: OrderStatus
  totalAmount: number
  itemCount: number
  totalQuantity: number
  /** Tối đa 3 dòng đầu */
  previewItems: Array<Pick<OrderItem, 'productId' | 'productName' | 'unitPrice' | 'quantity' | 'productImageUrl'>>
  createdAt: string
}

export type TimelineActor = 'CUSTOMER' | 'STAFF' | 'SYSTEM'

/** Khớp TimelineEntryDto */
export type TimelineEntry = {
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  note: string | null
  actor: TimelineActor
  /** Chỉ nhân viên nhận được */
  changedBy?: { id: string; fullName: string; role: Role } | null
  createdAt: string
}

/** Khớp OrderDetailDto (GET /orders/:id) */
export type OrderDetail = Order &
  CustomerActions & {
    items: Array<OrderItem & { productSlug: string }>
    /** Cũ trước mới sau */
    timeline: TimelineEntry[]
    /** Khách đặt đơn – chỉ nhân viên nhận được */
    customer?: { id: string; fullName: string; email: string }
  }

/** Khớp StaffOrderSummaryDto (GET /orders cho nhân viên) */
export type StaffOrderSummary = OrderSummary & {
  customer: { id: string; fullName: string; email: string }
  recipientName: string
  recipientPhone: string
  nextStatus: OrderStatus | null
  canStaffCancel: boolean
}

/** Dòng không đặt được trong body lỗi 409 của POST /orders */
export type CheckoutProblem = {
  productId: string
  productName: string
  issue: 'INACTIVE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK'
  stock: number
}

export type ShippingInfo = {
  recipientName: string
  recipientPhone: string
  shippingAddress: string
}

export type StaffOrderSort = 'newest' | 'oldest'

/** Tham số GET /orders (nhân viên) */
export type StaffOrderQuery = {
  status?: OrderStatus[]
  q?: string
  from?: string
  to?: string
  sort?: StaffOrderSort
  page?: number
  limit?: number
}
