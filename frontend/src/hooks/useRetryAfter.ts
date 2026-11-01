import { useState } from 'react'
import { getRetryAfter } from '@/api/errors'
import { useNow } from './useNow'

/** Đếm ngược sau lỗi 429 cho tới khi được thử lại. `secondsLeft` = 0 là được gửi lại */
export function useRetryAfter() {
  const [retryAt, setRetryAt] = useState(0)
  const now = useNow(1000)
  const secondsLeft = Math.max(0, Math.ceil((retryAt - now) / 1000))

  /** Gọi trong catch: lỗi 429 thì bắt đầu đếm ngược và trả true */
  const track = (error: unknown) => {
    const seconds = getRetryAfter(error)
    if (seconds === undefined) return false
    setRetryAt(Date.now() + seconds * 1000)
    return true
  }

  return { secondsLeft, track }
}
