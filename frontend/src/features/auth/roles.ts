import { PATHS } from '@/app/paths'
import type { Role } from './types'

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Khách hàng',
  SUPPORT: 'Chăm sóc khách hàng',
  WAREHOUSE: 'Nhân viên kho',
  ADMIN: 'Quản trị viên',
}

/** Nhân viên làm việc ở khu quản lý (không mua hàng) */
export const STAFF_ROLES: Role[] = ['SUPPORT', 'WAREHOUSE', 'ADMIN']

/** Trang chính sau khi đăng nhập / khi vào nhầm khu của role khác */
export function homePathFor(role: Role) {
  return role === 'CUSTOMER' ? PATHS.home : PATHS.staffOrders
}
