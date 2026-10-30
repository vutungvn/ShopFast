import type { OrderStatus } from './types'

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  CONFIRMED: 'Đã xác nhận',
  PACKING: 'Đang đóng gói',
  SHIPPING: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã huỷ',
}

/** Màu nhãn trạng thái: nền nhạt + viền + chấm */
export const STATUS_STYLES: Record<OrderStatus, { pill: string; dot: string }> = {
  PENDING_PAYMENT: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  PAID: { pill: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  CONFIRMED: { pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' },
  PACKING: { pill: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  SHIPPING: { pill: 'bg-cyan-50 text-cyan-700 ring-cyan-200', dot: 'bg-cyan-500' },
  DELIVERED: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { pill: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
}

/** Các bước của một đơn đi hết vòng đời (không gồm huỷ) */
export const ORDER_STEPS: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
  'PACKING',
  'SHIPPING',
  'DELIVERED',
]

/** Tên bước trên thanh tiến trình (bước đầu là lúc đặt hàng) */
export const STEP_LABELS: Record<OrderStatus, string> = {
  ...STATUS_LABELS,
  PENDING_PAYMENT: 'Đặt hàng',
}

// Quy tắc khớp backend (order-rules.ts). Danh sách của kho có sẵn nextStatus/canStaffCancel,
// còn chi tiết đơn thì không nên UI tự tính theo các quy tắc này.

/** Khách huỷ được khi kho chưa xác nhận */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['PENDING_PAYMENT', 'PAID']
/** Kho / admin huỷ được tới hết bước đóng gói */
export const STAFF_CANCELLABLE: readonly OrderStatus[] = [...CUSTOMER_CANCELLABLE, 'CONFIRMED', 'PACKING']

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PAID: 'CONFIRMED',
  CONFIRMED: 'PACKING',
  PACKING: 'SHIPPING',
  SHIPPING: 'DELIVERED',
}

/** Bước kế tiếp kho được chuyển; null nếu đơn không đi tiếp được (chưa thanh toán, đã kết thúc) */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  return NEXT_STATUS[status] ?? null
}

/** Chữ trên nút kho bấm để chuyển sang trạng thái này */
export const ADVANCE_LABELS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Xác nhận',
  PACKING: 'Bắt đầu đóng gói',
  SHIPPING: 'Giao vận chuyển',
  DELIVERED: 'Xác nhận đã giao',
}

/** Tab trên trang "Đơn mua": gộp nhiều trạng thái vào một tab */
export const CUSTOMER_TABS = [
  { key: 'all', label: 'Tất cả', statuses: [] },
  { key: 'pending', label: 'Chờ thanh toán', statuses: ['PENDING_PAYMENT'] },
  { key: 'processing', label: 'Đang xử lý', statuses: ['PAID', 'CONFIRMED', 'PACKING'] },
  { key: 'shipping', label: 'Đang giao', statuses: ['SHIPPING'] },
  { key: 'done', label: 'Hoàn thành', statuses: ['DELIVERED'] },
  { key: 'cancelled', label: 'Đã huỷ', statuses: ['CANCELLED'] },
] as const satisfies ReadonlyArray<{ key: string; label: string; statuses: readonly OrderStatus[] }>

export type CustomerTab = (typeof CUSTOMER_TABS)[number]['key']
