import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet } from 'react-router'
import { PATHS } from '@/app/paths'
import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/features/auth/auth-context'
import { RoleBadge } from '@/features/auth/components/RoleBadge'

/** Khung các trang sau khi đăng nhập: header + nội dung. */
export function AppLayout() {
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to={PATHS.home} aria-label="ShopFast – Trang chủ">
            <Logo />
          </Link>

          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <RoleBadge role={user.role} className="hidden sm:inline-flex" />
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
              >
                <LogOut className="size-4" aria-hidden />
                {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
