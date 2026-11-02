import { socket } from '@/api/socket'
import { queryClient } from '@/app/queryClient'
import { SUPPORT_QUERY_KEY } from './queries'

/** Khớp TICKET_UPDATED (backend ticket-events.ts): `{ ticketId }`, chỉ để biết cần tải lại */
const TICKET_UPDATED = 'ticket:updated'

/**
 * Nhận thay đổi ticket realtime (AuthProvider gọi khi đã đăng nhập; kết nối do startOrderLive mở).
 * Khách chỉ nhận ticket của mình, CSKH / admin nhận mọi ticket. Trả về hàm dừng.
 */
export function startSupportLive(): () => void {
  // Chỉ tải lại các truy vấn đang hiển thị (cuộc trò chuyện, danh sách, số đề xuất chờ duyệt)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: SUPPORT_QUERY_KEY })
  let connectedBefore = socket.connected
  // Kết nối lại sau khi mất mạng: có thể đã lỡ sự kiện nên tải lại cho chắc
  const onConnect = () => {
    if (connectedBefore) refresh()
    connectedBefore = true
  }

  socket.on('connect', onConnect)
  socket.on(TICKET_UPDATED, refresh)
  return () => {
    socket.off('connect', onConnect)
    socket.off(TICKET_UPDATED, refresh)
  }
}
