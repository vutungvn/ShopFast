import { CircleAlert, CircleCheck, Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

const VARIANTS = {
  error: { box: 'border-red-200 bg-red-50 text-red-700', Icon: CircleAlert },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-700', Icon: CircleCheck },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-800', Icon: Clock },
}

export type AlertVariant = keyof typeof VARIANTS

type AlertProps = {
  variant: AlertVariant
  children: ReactNode
  className?: string
}

export function Alert({ variant, children, className }: AlertProps) {
  const { box, Icon } = VARIANTS[variant]
  return (
    <div
      // Lỗi/cảnh báo được đọc ngay; thông báo thành công đọc khi rảnh
      role={variant === 'success' ? 'status' : 'alert'}
      className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm', box, className)}
    >
      <Icon className="mt-px size-[18px] shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
