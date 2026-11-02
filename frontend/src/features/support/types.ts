import type { OrderStatus } from '@/features/orders/types'

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type TicketCategory =
  | 'ORDER_STATUS'
  | 'SHIPPING'
  | 'PAYMENT'
  | 'RETURN_REFUND'
  | 'PRODUCT_INQUIRY'
  | 'ACCOUNT'
  | 'OTHER'
export type MessageSender = 'CUSTOMER' | 'STAFF' | 'AI'
export type AgentActionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED'

/** Khớp TicketSummaryDto (backend) */
export type TicketSummary = {
  id: string
  subject: string
  category: TicketCategory | null
  status: TicketStatus
  orderCode: string | null
  /** Chỉ nhân viên nhận được */
  customerName?: string
  pendingActions: number
  createdAt: string
  updatedAt: string
}

export type TicketMessage = {
  id: string
  senderType: MessageSender
  senderName: string | null
  content: string
  createdAt: string
}

/** Đề xuất của trợ lý AI trong một ticket */
export type TicketAction = {
  id: string
  type: string
  orderCode: string
  status: AgentActionStatus
  reason: string | null
  note: string | null
  createdAt: string
}

export type TicketDetail = TicketSummary & {
  orderId: string | null
  /** Trợ lý AI còn tự trả lời không */
  aiActive: boolean
  messages: TicketMessage[]
  actions: TicketAction[]
}

/** Khớp AgentActionDto (backend) */
export type AgentAction = {
  id: string
  type: string
  status: AgentActionStatus
  reason: string | null
  note: string | null
  orderId: string
  orderCode: string
  orderStatus: OrderStatus | null
  ticketId: string
  ticketSubject: string
  customerName: string
  reviewerName: string | null
  createdAt: string
  reviewedAt: string | null
}

export type TicketQuery = {
  status?: TicketStatus
  category?: TicketCategory
  orderId?: string
  /** Chỉ yêu cầu còn mở (Mới / Đang xử lý) */
  open?: boolean
  page?: number
  limit?: number
}
