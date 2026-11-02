import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { ORDERS_QUERY_KEY } from '@/features/orders/queries'
import { supportApi } from './api'
import type { AgentActionStatus, TicketCategory, TicketDetail, TicketQuery, TicketStatus } from './types'

export const SUPPORT_QUERY_KEY = ['support'] as const

/** Dữ liệu riêng của người đăng nhập: đưa id vào key để đổi tài khoản không thấy dữ liệu cũ */
function useSupportKey() {
  const { user } = useAuth()
  return [...SUPPORT_QUERY_KEY, user?.id] as const
}

/**
 * Thay đổi của người khác (nhân viên trả lời, duyệt đề xuất, tin khách mới) đến qua realtime (live.ts).
 * Tải lại định kỳ chỉ là dự phòng khi kết nối realtime có vấn đề
 */
const FALLBACK_REFRESH_MS = 60_000

export function useTickets(query: TicketQuery) {
  const key = useSupportKey()
  return useQuery({
    queryKey: [...key, 'tickets', query],
    queryFn: () => supportApi.list(query),
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchInterval: FALLBACK_REFRESH_MS,
  })
}

/**
 * Yêu cầu còn mở gần nhất của khách (gắn với `orderId` nếu có): mở lại cuộc trò chuyện thay vì tạo mới.
 * `null` = chưa có, tạo mới.
 */
export function useOpenTicket(orderId?: string, enabled = true) {
  const key = useSupportKey()
  return useQuery({
    queryKey: [...key, 'tickets', 'open', orderId ?? null],
    queryFn: () => supportApi.list({ open: true, orderId, limit: 1 }).then((page) => page.items[0] ?? null),
    enabled,
    staleTime: 0,
  })
}

export function useTicket(id: string, enabled = true) {
  const key = useSupportKey()
  return useQuery({
    queryKey: [...key, 'ticket', id],
    queryFn: () => supportApi.detail(id),
    enabled: enabled && Boolean(id),
    staleTime: 0,
    refetchInterval: FALLBACK_REFRESH_MS,
  })
}

export function useAgentActions(query: { status?: AgentActionStatus; page: number; limit: number }) {
  const key = useSupportKey()
  return useQuery({
    queryKey: [...key, 'actions', query],
    queryFn: () => supportApi.actions(query),
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchInterval: FALLBACK_REFRESH_MS,
  })
}

/** Số đề xuất đang chờ duyệt (badge trên menu nhân viên) */
export function usePendingActionCount(enabled: boolean) {
  const key = useSupportKey()
  return useQuery({
    queryKey: [...key, 'actions', 'pending-count'],
    queryFn: () => supportApi.actions({ status: 'PENDING', limit: 1 }).then((page) => page.meta.total),
    enabled,
    refetchInterval: FALLBACK_REFRESH_MS,
  })
}

/** Mọi thao tác: ghi ngay chi tiết ticket trả về, tải lại danh sách */
function useSupportMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  const key = useSupportKey()
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      const ticket = result as Partial<TicketDetail>
      if (ticket.messages) queryClient.setQueryData([...key, 'ticket', ticket.id], ticket)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SUPPORT_QUERY_KEY }),
  })
}

export function useCreateTicket() {
  return useSupportMutation(supportApi.create)
}

export function useSendMessage(ticketId: string) {
  return useSupportMutation((content: string) => supportApi.send(ticketId, content))
}

export function useUpdateTicket(ticketId: string) {
  return useSupportMutation((change: { status?: TicketStatus; category?: TicketCategory }) =>
    supportApi.update(ticketId, change),
  )
}

export function useHandBack(ticketId: string) {
  return useSupportMutation(() => supportApi.handBack(ticketId))
}

/** Duyệt / từ chối đổi cả đơn hàng (huỷ, trả kho): tải lại cả dữ liệu đơn */
export function useReviewAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reject }: { id: string; reject?: string }) =>
      reject === undefined ? supportApi.approve(id) : supportApi.reject(id, reject),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SUPPORT_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
    },
  })
}
