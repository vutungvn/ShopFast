import { ShoppingCart } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router'
import { PATHS } from '@/app/paths'
import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/features/auth/auth-context'
import { useCart } from '@/features/cart/queries'
import { cn } from '@/lib/cn'
import { HeaderSearch } from './HeaderSearch'
import { UserMenu } from './UserMenu'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn('text-sm font-medium transition-colors', isActive ? 'text-brand-600' : 'text-slate-600 hover:text-slate-900')

/** Khung chung của các trang mua sắm (công khai lẫn cần đăng nhập): header + nội dung + footer. */
export function ShopLayout() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const currentQuery = pathname === PATHS.home ? (searchParams.get('q') ?? '') : ''
  // Nhân viên không có giỏ; khách chưa đăng nhập bấm vào sẽ được đưa sang đăng nhập
  const { user } = useAuth()
  const showCart = !user || user.role === 'CUSTOMER'
  const itemCount = useCart().data?.itemCount ?? 0

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:gap-8 lg:px-8">
          <Link to={PATHS.home} aria-label="ShopFast – Trang chủ" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Điều hướng chính">
            <NavLink to={PATHS.home} end className={navClass}>
              Sản phẩm
            </NavLink>
            {/* Khách (người chưa đăng nhập bấm vào sẽ sang đăng nhập) xem đơn mua; nhân viên sang khu quản lý */}
            {showCart ? (
              <NavLink to={PATHS.orders} className={navClass}>
                Đơn mua
              </NavLink>
            ) : (
              <NavLink to={PATHS.staffOrders} className={navClass}>
                Trang nhân viên
              </NavLink>
            )}
          </nav>

          <HeaderSearch key={currentQuery} initialQuery={currentQuery} className="hidden max-w-xl flex-1 md:block" />

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {showCart && (
              <>
                <NavLink
                  to={PATHS.cart}
                  aria-label={itemCount ? `Giỏ hàng (${itemCount} sản phẩm)` : 'Giỏ hàng'}
                  className={({ isActive }) =>
                    cn(
                      'relative flex size-10 items-center justify-center rounded-xl transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                      isActive ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )
                  }
                >
                  <ShoppingCart className="size-5" aria-hidden />
                  {itemCount > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold text-white ring-2 ring-white"
                      aria-hidden
                    >
                      {itemCount > 99 ? '99+' : itemCount}
                    </span>
                  )}
                </NavLink>
                <span className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
              </>
            )}
            <UserMenu />
          </div>
        </div>

        <div className="px-4 pb-3 sm:px-6 md:hidden">
          <HeaderSearch key={currentQuery} initialQuery={currentQuery} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          © 2026 ShopFast
        </div>
      </footer>
    </div>
  )
}
