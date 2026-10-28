import { Navigate, Outlet, useLocation } from 'react-router'
import { PATHS } from '@/app/paths'
import { SplashScreen } from '@/components/layout/SplashScreen'
import { useAuth } from '../auth-context'
import type { LoginPageState } from '../types'

/**
 * Trang chỉ dành cho người chưa đăng nhập (đăng nhập, đăng ký).
 * Đăng nhập thành công cũng đi qua đây: chuyển về trang định vào trước đó.
 */
export function GuestOnly() {
  const { status } = useAuth()
  const state = useLocation().state as LoginPageState | null

  if (status === 'loading') return <SplashScreen />
  if (status === 'authenticated') return <Navigate to={state?.from ?? PATHS.home} replace />
  return <Outlet />
}
