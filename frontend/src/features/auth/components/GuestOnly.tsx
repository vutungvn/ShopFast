import { Navigate, Outlet, useLocation } from 'react-router'
import { SplashScreen } from '@/components/layout/SplashScreen'
import { useAuth } from '../auth-context'
import { homePathFor } from '../roles'
import type { LoginPageState } from '../types'

/**
 * Trang chỉ dành cho người chưa đăng nhập (đăng nhập, đăng ký).
 * Đăng nhập thành công cũng đi qua đây: chuyển về trang định vào trước đó.
 */
export function GuestOnly() {
  const { status, user } = useAuth()
  const state = useLocation().state as LoginPageState | null

  if (status === 'loading') return <SplashScreen />
  // Không có trang định vào trước đó: khách về cửa hàng, nhân viên về quản lý đơn
  if (status === 'authenticated') return <Navigate to={state?.from ?? homePathFor(user.role)} replace />
  return <Outlet />
}
