import { Store } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { PATHS } from '@/app/paths'
import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/cn'
import { UserMenu } from './UserMenu'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative flex h-16 items-center text-sm font-medium transition-colors',
    isActive
      ? 'text-brand-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand-600'
      : 'text-slate-600 hover:text-slate-900',
  )

/** Khung các trang nội bộ cho nhân viên (kho, CSKH, admin): không có giỏ hàng, tìm kiếm sản phẩm. */
export function StaffLayout() {
  const { user } = useAuth()
  const managesStock = user?.role === 'WAREHOUSE' || user?.role === 'ADMIN'

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:gap-8 lg:px-8">
          <Link to={PATHS.staffOrders} aria-label="ShopFast – Trang nhân viên" className="flex shrink-0 items-center gap-2">
            <Logo />
            <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 sm:inline">
              Nhân viên
            </span>
          </Link>

          <nav className="flex items-center gap-5 sm:gap-6" aria-label="Điều hướng nhân viên">
            <NavLink to={PATHS.staffOrders} className={navClass}>
              Quản lý đơn
            </NavLink>
            {managesStock && (
              <NavLink to={PATHS.staffInventory} className={navClass}>
                Tồn kho
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link
              to={PATHS.home}
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:flex"
            >
              <Store className="size-4" aria-hidden />
              Xem cửa hàng
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          © 2026 ShopFast · Hệ thống nội bộ
        </div>
      </footer>
    </div>
  )
}
