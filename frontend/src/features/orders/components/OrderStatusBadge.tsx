import { cn } from '@/lib/cn'
import { STATUS_LABELS, STATUS_STYLES } from '../order-status'
import type { OrderStatus } from '../types'

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        style.pill,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}
