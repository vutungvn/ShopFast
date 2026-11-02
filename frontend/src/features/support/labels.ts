import type { AgentActionStatus, TicketCategory, TicketStatus } from './types'

export const TICKET_STATUS: Record<TicketStatus, { label: string; pill: string }> = {
  OPEN: { label: 'Mới', pill: 'bg-sky-50 text-sky-700 ring-sky-200' },
  IN_PROGRESS: { label: 'Đang xử lý', pill: 'bg-amber-50 text-amber-700 ring-amber-200' },
  RESOLVED: { label: 'Đã giải quyết', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CLOSED: { label: 'Đã đóng', pill: 'bg-slate-100 text-slate-600 ring-slate-200' },
}

export const TICKET_STATUSES = Object.keys(TICKET_STATUS) as TicketStatus[]

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ORDER_STATUS: 'Tình trạng đơn',
  SHIPPING: 'Giao hàng',
  PAYMENT: 'Thanh toán',
  RETURN_REFUND: 'Huỷ / đổi trả',
  PRODUCT_INQUIRY: 'Sản phẩm',
  ACCOUNT: 'Tài khoản',
  OTHER: 'Khác',
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as TicketCategory[]

export const ACTION_STATUS: Record<AgentActionStatus, { label: string; pill: string }> = {
  PENDING: { label: 'Chờ duyệt', pill: 'bg-amber-50 text-amber-700 ring-amber-200' },
  APPROVED: { label: 'Đã duyệt', pill: 'bg-sky-50 text-sky-700 ring-sky-200' },
  EXECUTED: { label: 'Đã thực hiện', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  REJECTED: { label: 'Bị từ chối', pill: 'bg-slate-100 text-slate-600 ring-slate-200' },
  FAILED: { label: 'Không thực hiện được', pill: 'bg-red-50 text-red-700 ring-red-200' },
}

export const ACTION_TYPE_LABELS: Record<string, string> = {
  CANCEL_ORDER: 'Huỷ đơn',
}

/** Khớp giới hạn nội dung tin nhắn của backend */
export const MAX_MESSAGE = 1000
