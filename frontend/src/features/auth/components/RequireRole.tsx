import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../auth-context'
import { homePathFor } from '../roles'
import type { Role } from '../types'

/**
 * Chỉ cho các role được phép vào; role khác về trang chính của role đó (khách → cửa hàng,
 * nhân viên → quản lý đơn). Đặt bên trong RequireAuth nên lúc này đã có user.
 */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth()
  if (!user) return null
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />
  return <Outlet />
}
