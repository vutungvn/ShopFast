import { useSyncExternalStore } from 'react'

/** Đơn đang hỏi (mở từ trang chi tiết đơn) */
export type ChatOrder = { orderId: string; code: string }

type ChatWidgetState = {
  open: boolean
  order: ChatOrder | null
  /** true: bắt đầu cuộc trò chuyện mới thay vì nói tiếp cuộc đang mở */
  fresh: boolean
  /** Tăng mỗi lần mở để cửa sổ bắt đầu lại từ đầu */
  session: number
}

let state: ChatWidgetState = { open: false, order: null, fresh: false, session: 0 }
const listeners = new Set<() => void>()

function setState(next: ChatWidgetState) {
  state = next
  for (const listener of listeners) listener()
}

/** Mở cửa sổ chat với trợ lý AI; `order` để hỏi riêng về đơn đó, `fresh` để mở cuộc trò chuyện mới */
export function openChatWidget({ order = null, fresh = false }: { order?: ChatOrder | null; fresh?: boolean } = {}) {
  setState({ open: true, order, fresh, session: state.session + 1 })
}

export function closeChatWidget() {
  setState({ ...state, open: false })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Trạng thái cửa sổ chat dùng chung cả trang (bong bóng ở layout, nút ở trang chi tiết đơn) */
export function useChatWidget(): ChatWidgetState {
  return useSyncExternalStore(subscribe, () => state)
}
