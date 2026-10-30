import { CircleAlert, CircleCheck, TriangleAlert, X } from 'lucide-react'
import { useEffect, useEffectEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const VARIANTS = {
  success: { Icon: CircleCheck, icon: 'text-emerald-600' },
  error: { Icon: CircleAlert, icon: 'text-red-600' },
  warning: { Icon: TriangleAlert, icon: 'text-amber-600' },
}

type ToastProps = {
  variant: keyof typeof VARIANTS
  title: string
  children?: ReactNode
  onClose: () => void
  /** Tự đóng sau khoảng này (ms). Đổi `key` để hiện lại và đếm lại từ đầu */
  duration?: number
}

/** Thông báo nổi góc trên bên phải (mobile: ngang màn hình) */
export function Toast({ variant, title, children, onClose, duration = 5000 }: ToastProps) {
  const { Icon, icon } = VARIANTS[variant]
  const close = useEffectEvent(onClose)

  useEffect(() => {
    const timer = setTimeout(close, duration)
    return () => clearTimeout(timer)
  }, [duration])

  return (
    <div
      role={variant === 'success' ? 'status' : 'alert'}
      className="fixed top-20 right-4 left-4 z-30 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/70 sm:left-auto sm:w-96"
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {children && <div className="mt-1 text-sm text-slate-600">{children}</div>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng thông báo"
        className="-m-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
