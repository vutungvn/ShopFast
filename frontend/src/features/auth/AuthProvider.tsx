import { useEffect, useState, type ReactNode } from 'react'
import { refreshAccessToken, setAccessToken, setSessionExpiredHandler } from '@/api/client'
import { queryClient } from '@/app/queryClient'
import { CART_QUERY_KEY } from '@/features/cart/queries'
import { authApi } from './api'
import { AuthContext, type AuthState } from './auth-context'

const ANONYMOUS: AuthState = { status: 'anonymous', user: null, signedOutReason: null }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    signedOutReason: null,
  })

  // Mở/tải lại trang: access token trong bộ nhớ đã mất, dùng cookie refresh để khôi phục phiên.
  // StrictMode chạy effect 2 lần nhưng refreshAccessToken dùng chung một request nên không bị coi là dùng lại token.
  useEffect(() => {
    let cancelled = false
    refreshAccessToken()
      .then(() => authApi.me())
      .then((user) => {
        if (!cancelled) setState({ status: 'authenticated', user, signedOutReason: null })
      })
      .catch(() => {
        if (cancelled) return
        setAccessToken(null)
        setState(ANONYMOUS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Refresh thất bại giữa chừng (cookie hết hạn, bị thu hồi khi đổi vai trò...)
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearPrivateData()
      setState({ status: 'anonymous', user: null, signedOutReason: 'session-expired' })
    })
    return () => setSessionExpiredHandler(null)
  }, [])

  const login = async (email: string, password: string) => {
    const { accessToken, user } = await authApi.login(email, password)
    setAccessToken(accessToken)
    setState({ status: 'authenticated', user, signedOutReason: null })
  }

  const logout = async () => {
    // Lỗi mạng khi đăng xuất vẫn xoá phiên phía trình duyệt; cookie còn lại sẽ tự hết hạn
    await authApi.logout().catch(() => undefined)
    setAccessToken(null)
    clearPrivateData()
    setState({ status: 'anonymous', user: null, signedOutReason: 'logged-out' })
  }

  return <AuthContext value={{ ...state, login, logout }}>{children}</AuthContext>
}

/** Bỏ dữ liệu riêng của người dùng khỏi cache khi rời phiên */
function clearPrivateData() {
  queryClient.removeQueries({ queryKey: CART_QUERY_KEY })
}
