import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getErrorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { authApi } from '@/features/auth/api'
import { RoleBadge } from '@/features/auth/components/RoleBadge'
import { ROLE_LABELS } from '@/features/auth/roles'
import type { User } from '@/features/auth/types'
import { getInitials } from '@/lib/format'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'success'; user: User }
  | { kind: 'error'; message: string }

const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' })

/** Thông tin tài khoản lấy trực tiếp từ GET /users/me (endpoint cần đăng nhập). */
export function AccountPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    authApi
      .me()
      .then((user) => !cancelled && setState({ kind: 'success', user }))
      .catch((error) => !cancelled && setState({ kind: 'error', message: getErrorMessage(error) }))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const reload = () => {
    setState({ kind: 'loading' })
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <title>Tài khoản của tôi · ShopFast</title>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Tài khoản của tôi</h1>
        <button
          type="button"
          onClick={reload}
          disabled={state.kind === 'loading'}
          className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
        >
          <RefreshCw className={state.kind === 'loading' ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
          Tải lại
        </button>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {state.kind === 'loading' && <AccountSkeleton />}
        {state.kind === 'error' && <Alert variant="error">{state.message}</Alert>}
        {state.kind === 'success' && <AccountDetails user={state.user} />}
      </section>
    </div>
  )
}

function AccountDetails({ user }: { user: User }) {
  const rows = [
    ['Email', user.email],
    ['Số điện thoại', user.phone ?? '—'],
    ['Vai trò', ROLE_LABELS[user.role]],
    ['Ngày tạo', dateFormat.format(new Date(user.createdAt))],
  ]
  return (
    <>
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
          {getInitials(user.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-slate-900">{user.fullName}</p>
          <RoleBadge role={user.role} className="mt-1" />
        </div>
      </div>
      <dl className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-slate-500">{label}</dt>
            <dd className="text-sm font-medium break-all text-slate-900 sm:col-span-2">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

function AccountSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Đang tải thông tin tài khoản">
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-full bg-slate-200" />
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="h-4 w-24 rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 rounded bg-slate-100" />
        ))}
      </div>
    </div>
  )
}
