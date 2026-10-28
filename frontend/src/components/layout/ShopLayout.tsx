import { ShoppingCart } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router'
import { PATHS } from '@/app/paths'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { HeaderSearch } from './HeaderSearch'
import { UserMenu } from './UserMenu'

/** Khung chung của các trang mua sắm (công khai lẫn cần đăng nhập): header + nội dung + footer. */
export function ShopLayout() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const currentQuery = pathname === PATHS.home ? (searchParams.get('q') ?? '') : ''

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:gap-8 lg:px-8">
          <Link to={PATHS.home} aria-label="ShopFast – Trang chủ" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden md:block" aria-label="Điều hướng chính">
            <NavLink
              to={PATHS.home}
              end
              className={({ isActive }) =>
                cn(
                  'text-sm font-medium transition-colors',
                  isActive ? 'text-brand-600' : 'text-slate-600 hover:text-slate-900',
                )
              }
            >
              Sản phẩm
            </NavLink>
          </nav>

          <HeaderSearch key={currentQuery} initialQuery={currentQuery} className="hidden max-w-xl flex-1 md:block" />

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Giỏ hàng làm ở bước sau */}
            <span
              title="Giỏ hàng sắp ra mắt"
              aria-label="Giỏ hàng (sắp ra mắt)"
              className="flex size-10 cursor-not-allowed items-center justify-center rounded-xl text-slate-400"
            >
              <ShoppingCart className="size-5" aria-hidden />
            </span>
            <span className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
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
