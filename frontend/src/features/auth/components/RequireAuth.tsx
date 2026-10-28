import { Navigate, Outlet, useLocation } from 'react-router'
import { PATHS } from '@/app/paths'
import { SplashScreen } from '@/components/layout/SplashScreen'
import { useAuth } from '../auth-context'
import type { LoginPageState } from '../types'

/** Chỉ cho vào khi đã đăng nhập; ngược lại chuyển sang trang đăng nhập kèm lý do. */
export function RequireAuth() {
  const { status, signedOutReason } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <SplashScreen fullScreen={false} />
  if (status === 'anonymous') {
    const state: LoginPageState = {
      notice: signedOutReason ?? undefined,
      // Tự đăng xuất thì không cần quay lại trang cũ
      from: signedOutReason === 'logged-out' ? undefined : location.pathname + location.search,
    }
    return <Navigate to={PATHS.login} replace state={state} />
  }
  return <Outlet />
}
