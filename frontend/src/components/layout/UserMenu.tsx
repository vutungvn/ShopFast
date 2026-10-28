import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { PATHS } from '@/app/paths'
import { buttonClasses } from '@/components/ui/button-styles'
import { useAuth } from '@/features/auth/auth-context'
import { RoleBadge } from '@/features/auth/components/RoleBadge'
import type { LoginPageState } from '@/features/auth/types'
import { cn } from '@/lib/cn'
import { getInitials } from '@/lib/format'

export function UserMenu() {
  const { status, user, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Đóng menu khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (status === 'loading') {
    return <div className="size-9 animate-pulse rounded-full bg-slate-200" aria-hidden />
  }

  if (!user) {
    // Đăng nhập xong quay lại đúng trang đang xem
    const state: LoginPageState = { from: location.pathname + location.search }
    return (
      <div className="flex items-center gap-2">
        <Link to={PATHS.login} state={state} className={buttonClasses('ghost', 'sm')}>
          Đăng nhập
        </Link>
        {/* Bọc ngoài để ẩn trên mobile: ghép "hidden" với "inline-flex" của nút thì inline-flex thắng */}
        <span className="hidden sm:block">
          <Link to={PATHS.register} className={buttonClasses('primary', 'sm')}>
            Đăng ký
          </Link>
        </span>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-xl p-1 pr-2 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
          {getInitials(user.fullName)}
        </span>
        <span className="hidden max-w-40 text-left md:block">
          <span className="block truncate text-sm font-medium text-slate-900">{user.fullName}</span>
          <RoleBadge role={user.role} className="mt-0.5 px-2 py-0 text-[11px]" />
        </span>
        <ChevronDown className={cn('size-4 text-slate-400 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/70"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <Link
            to={PATHS.account}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <UserRound className="size-4 text-slate-400" aria-hidden />
            Tài khoản của tôi
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void logout()
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="size-4 text-slate-400" aria-hidden />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}
