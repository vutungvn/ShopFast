import { http } from '@/api/client'
import type { Paginated } from '@/features/catalog/types'
import type {
  Order,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  ShippingInfo,
  StaffOrderQuery,
  StaffOrderSummary,
} from './types'

// axios mặc định gửi mảng dạng status[]=a; backend nhận status=a,b
const statusParam = (status?: readonly OrderStatus[]) => (status?.length ? status.join(',') : undefined)

export const ordersApi = {
  /** Đặt đơn từ toàn bộ giỏ; giỏ có dòng lỗi => 409 kèm `items` */
  place: (shipping: ShippingInfo) => http.post<Order>('/orders', shipping).then((res) => res.data),

  pay: (orderId: string) => http.post<Order>(`/orders/${orderId}/pay`).then((res) => res.data),

  /** Khách: lý do tuỳ chọn. Kho / admin: bắt buộc lý do ≥ 5 ký tự */
  cancel: (orderId: string, reason: string) =>
    http.post<Order>(`/orders/${orderId}/cancel`, reason ? { reason } : {}).then((res) => res.data),

  mine: ({ status, page, limit }: { status?: readonly OrderStatus[]; page: number; limit: number }) =>
    http
      .get<Paginated<OrderSummary>>('/orders/me', { params: { status: statusParam(status), page, limit } })
      .then((res) => res.data),

  detail: (orderId: string) => http.get<OrderDetail>(`/orders/${orderId}`).then((res) => res.data),

  staffList: ({ status, ...query }: StaffOrderQuery) =>
    http
      .get<Paginated<StaffOrderSummary>>('/orders', { params: { ...query, status: statusParam(status) } })
      .then((res) => res.data),

  stats: () => http.get<{ counts: Record<OrderStatus, number> }>('/orders/stats').then((res) => res.data.counts),

  /** Gửi trạng thái ĐÍCH; không đúng bước kế tiếp => 409 kèm `currentStatus` */
  advance: (orderId: string, status: OrderStatus, note: string) =>
    http
      .patch<OrderDetail>(`/orders/${orderId}/status`, note ? { status, note } : { status })
      .then((res) => res.data),
}
