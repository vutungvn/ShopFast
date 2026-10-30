import { X, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  /** Dòng nhỏ phía trên tiêu đề, vd "Xác nhận huỷ" */
  eyebrow?: string
  icon?: LucideIcon
  tone?: 'danger' | 'brand'
  children: ReactNode
  /** Thanh nút cuối hộp thoại; bỏ trống nếu nội dung tự có nút */
  footer?: ReactNode
  /** Đang gửi: không cho đóng bằng Esc / bấm nền */
  busy?: boolean
  className?: string
}

const TONES = {
  danger: { icon: 'bg-red-50 text-red-600', eyebrow: 'text-red-600' },
  brand: { icon: 'bg-brand-50 text-brand-600', eyebrow: 'text-brand-600' },
}

/** Hộp thoại dùng <dialog> gốc: có sẵn khoá focus bên trong, phím Esc và lớp nền mờ. */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  icon: Icon,
  tone = 'brand',
  children,
  footer,
  busy = false,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const close = () => !busy && onClose()

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      aria-labelledby={titleId}
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl bg-white p-0 shadow-xl backdrop:bg-slate-900/40',
        className,
      )}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className="flex items-start gap-4 px-6 pt-6">
          {Icon && (
            <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-full', TONES[tone].icon)}>
              <Icon className="size-6" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            {eyebrow && (
              <p className={cn('text-xs font-semibold tracking-wider uppercase', TONES[tone].eyebrow)}>{eyebrow}</p>
            )}
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Đóng"
            className="-mt-1 -mr-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  )
}
