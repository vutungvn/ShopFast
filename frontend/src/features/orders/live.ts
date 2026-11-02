import { useEffect, useEffectEvent } from 'react'
import { connectRealtime, socket, useConnectionState } from '@/api/socket'
import { queryClient } from '@/app/queryClient'
import { CUSTOMER_CANCELLABLE, STATUS_LABELS } from './order-status'
import { ORDERS_QUERY_KEY } from './queries'
import type { OrderDetail, OrderStatus, TimelineActor } from './types'

/** Khớp OrderUpdatedEvent (backend order-events.ts) */
export type OrderUpdatedEvent = {
  orderId: string
  code: string
  status: OrderStatus
  /** null = đơn vừa được tạo */
  previousStatus: OrderStatus | null
  actor: TimelineActor
  note: string | null
  /** Lúc server phát (ISO) */
  changedAt: string
}

type SubscribeAck = { ok: true } | { ok: false; message: string }

const ORDER_UPDATED = 'order:updated'

/** Đơn đang mở trên trang (đếm số nơi đang xem) để đăng ký lại sau khi kết nối lại */
const watched = new Map<string, number>()

function subscribe(orderId: string) {
  socket.emit('order:subscribe', { orderId }, (ack: SubscribeAck) => {
    if (!ack.ok) console.warn(`[realtime] Không theo dõi được đơn ${orderId}: ${ack.message}`)
  })
}

/**
 * Bắt đầu nhận sự kiện đơn hàng (AuthProvider gọi khi đã đăng nhập). Trả về hàm dừng.
 * Mỗi sự kiện: hiện ngay trạng thái mới từ dữ liệu sự kiện, rồi tải lại các danh sách / chi tiết đơn ở nền.
 */
export function startOrderLive(): () => void {
  let connectedBefore = false
  const onConnect = () => {
    // Kết nối mới là một socket mới ở server: đăng ký lại mọi đơn đang mở
    for (const orderId of watched.keys()) subscribe(orderId)
    // Kết nối lại sau khi mất mạng: có thể đã lỡ sự kiện nên tải lại cho chắc
    if (connectedBefore) void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
    connectedBefore = true
  }
  const onUpdated = (event: OrderUpdatedEvent) => {
    // Đo độ trễ (Console > Verbose); cùng máy với tab vừa thao tác thì đồng hồ không lệch
    console.debug(
      `[realtime] ${event.code} → ${STATUS_LABELS[event.status]}, trễ ${Date.now() - Date.parse(event.changedAt)} ms`,
    )
    queryClient.setQueriesData<OrderDetail>(
      {
        queryKey: ORDERS_QUERY_KEY,
        // Key chi tiết: ['orders', userId, 'detail', orderId]
        predicate: ({ queryKey }) => queryKey[2] === 'detail' && queryKey[3] === event.orderId,
      },
      (order) => order && applyEvent(order, event),
    )
    void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
  }

  socket.on('connect', onConnect)
  socket.on(ORDER_UPDATED, onUpdated)
  const disconnect = connectRealtime()
  return () => {
    socket.off('connect', onConnect)
    socket.off(ORDER_UPDATED, onUpdated)
    disconnect()
  }
}

/** Ghép sự kiện vào chi tiết đơn đang có. Chỉ tắt bớt thao tác (an toàn); bản tải lại ở nền mới là số liệu đúng */
function applyEvent(order: OrderDetail, event: OrderUpdatedEvent): OrderDetail {
  // Đã có trạng thái này (tự mình thao tác, hoặc đã tải lại xong)
  if (order.status === event.status) return order
  return {
    ...order,
    status: event.status,
    timeline: [
      ...order.timeline,
      {
        fromStatus: event.previousStatus,
        toStatus: event.status,
        note: event.note,
        actor: event.actor,
        createdAt: event.changedAt,
      },
    ],
    paidAt: event.status === 'PAID' ? event.changedAt : order.paidAt,
    cancelledAt: event.status === 'CANCELLED' ? event.changedAt : order.cancelledAt,
    canPay: order.canPay && event.status === 'PENDING_PAYMENT',
    canCancel: order.canCancel && CUSTOMER_CANCELLABLE.includes(event.status),
  }
}

function watchOrder(orderId: string): () => void {
  const count = watched.get(orderId) ?? 0
  watched.set(orderId, count + 1)
  // Chưa kết nối thì lúc kết nối xong sẽ tự đăng ký (onConnect)
  if (count === 0 && socket.connected) subscribe(orderId)
  return () => {
    const left = (watched.get(orderId) ?? 1) - 1
    if (left > 0) {
      watched.set(orderId, left)
      return
    }
    watched.delete(orderId)
    if (socket.connected) socket.emit('order:unsubscribe', { orderId })
  }
}

/** Nhận mọi sự kiện đơn hàng tới trình duyệt này (nhân viên nhận mọi đơn; khách chỉ đơn đang mở) */
export function useOrderEvents(onEvent: (event: OrderUpdatedEvent) => void) {
  const handle = useEffectEvent(onEvent)
  useEffect(() => {
    const listener = (event: OrderUpdatedEvent) => handle(event)
    socket.on(ORDER_UPDATED, listener)
    return () => {
      socket.off(ORDER_UPDATED, listener)
    }
  }, [])
  return useConnectionState()
}

/** Theo dõi realtime một đơn trong lúc trang đang mở. Trả về trạng thái kết nối */
export function useLiveOrder(orderId: string, onEvent?: (event: OrderUpdatedEvent) => void) {
  useEffect(() => (orderId ? watchOrder(orderId) : undefined), [orderId])
  return useOrderEvents((event) => {
    if (event.orderId === orderId) onEvent?.(event)
  })
}
