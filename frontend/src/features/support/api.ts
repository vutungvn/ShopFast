import { http } from '@/api/client'
import type { Paginated } from '@/features/catalog/types'
import type {
  AgentAction,
  AgentActionStatus,
  TicketCategory,
  TicketDetail,
  TicketQuery,
  TicketStatus,
  TicketSummary,
} from './types'

/** Trợ lý AI có thể mất vài giây (tra cứu nhiều bước), dài hơn mặc định 15 giây */
const AI_TIMEOUT = 60_000

export const supportApi = {
  /** Tạo yêu cầu: AI phân loại và trả lời tin đầu tiên */
  create: (body: { subject: string; message: string; orderId?: string }) =>
    http.post<TicketDetail>('/tickets', body, { timeout: AI_TIMEOUT }).then((res) => res.data),

  list: (query: TicketQuery) =>
    http.get<Paginated<TicketSummary>>('/tickets', { params: query }).then((res) => res.data),

  detail: (id: string) => http.get<TicketDetail>(`/tickets/${id}`).then((res) => res.data),

  /** Khách: AI trả lời luôn trong response. Nhân viên: tiếp nhận ticket */
  send: (id: string, content: string) =>
    http.post<TicketDetail>(`/tickets/${id}/messages`, { content }, { timeout: AI_TIMEOUT }).then((res) => res.data),

  /** CSKH trả cuộc trò chuyện lại cho trợ lý AI */
  handBack: (id: string) => http.post<TicketDetail>(`/tickets/${id}/handback`).then((res) => res.data),

  update: (id: string, change: { status?: TicketStatus; category?: TicketCategory }) =>
    http.patch<TicketDetail>(`/tickets/${id}`, change).then((res) => res.data),

  actions: (query: { status?: AgentActionStatus; page?: number; limit?: number }) =>
    http.get<Paginated<AgentAction>>('/agent-actions', { params: query }).then((res) => res.data),

  approve: (id: string) => http.post<AgentAction>(`/agent-actions/${id}/approve`).then((res) => res.data),

  reject: (id: string, reason: string) =>
    http.post<AgentAction>(`/agent-actions/${id}/reject`, { reason }).then((res) => res.data),
}
