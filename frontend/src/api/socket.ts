import { useSyncExternalStore } from 'react'
import { io } from 'socket.io-client'
import { getAccessToken, refreshAccessToken } from './client'

/** Backend từ chối bắt tay vì access token sai / hết hạn (OrdersGateway) */
const UNAUTHORIZED = 'UNAUTHORIZED'
/** Refresh xong vẫn bị từ chối liên tiếp ngần này lần thì thôi, không lặp vô hạn */
const MAX_AUTH_RETRIES = 2

// Cùng nguồn với trang: Vite proxy (dev) / Nginx (production) chuyển /socket.io sang api
export const socket = io({
  path: '/socket.io',
  autoConnect: false,
  // Dạng hàm: được gọi lại mỗi lần kết nối (lại) nên luôn gửi access token mới nhất
  auth: (cb) => cb({ token: getAccessToken() }),
})

let authRetries = 0
socket.on('connect', () => {
  authRetries = 0
})
socket.on('connect_error', (error: Error) => {
  // Lỗi mạng: thư viện tự thử lại. Bị từ chối bắt tay: thư viện dừng hẳn, phải refresh token rồi tự nối lại
  if (socket.active || error.message !== UNAUTHORIZED || authRetries >= MAX_AUTH_RETRIES) return
  authRetries++
  refreshAccessToken().then(
    () => socket.connect(),
    () => undefined,
  )
})

/** Mở kết nối realtime (đã đăng nhập). Trả về hàm đóng khi đăng xuất / đổi tài khoản */
export function connectRealtime(): () => void {
  // Trình duyệt báo mất mạng thì ngắt ngay thay vì chờ hết thời gian ping; có mạng lại thì nối lại
  const goOffline = () => socket.disconnect()
  const goOnline = () => socket.connect()
  window.addEventListener('offline', goOffline)
  window.addEventListener('online', goOnline)
  socket.connect()
  return () => {
    window.removeEventListener('offline', goOffline)
    window.removeEventListener('online', goOnline)
    socket.disconnect()
  }
}

export type ConnectionState = 'connected' | 'connecting' | 'offline'

const connectionState = (): ConnectionState =>
  socket.connected ? 'connected' : socket.active ? 'connecting' : 'offline'

function onConnectionChange(notify: () => void) {
  const events = ['connect', 'disconnect', 'connect_error'] as const
  for (const event of events) socket.on(event, notify)
  socket.io.on('reconnect_attempt', notify)
  return () => {
    for (const event of events) socket.off(event, notify)
    socket.io.off('reconnect_attempt', notify)
  }
}

/** Trạng thái kết nối realtime để hiện cho người dùng */
export function useConnectionState(): ConnectionState {
  return useSyncExternalStore(onConnectionChange, connectionState)
}
