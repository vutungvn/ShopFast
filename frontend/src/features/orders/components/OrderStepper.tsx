import { Check, CircleX } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { ORDER_STEPS, STEP_LABELS } from '../order-status'
import { actorLabel } from '../timeline'
import type { OrderStatus, TimelineEntry } from '../types'

type OrderStepperProps = {
  status: OrderStatus
  timeline: TimelineEntry[]
  viewer: 'customer' | 'staff'
}

/** Thanh tiến trình 6 bước; đơn đã huỷ thì thay bằng khung báo huỷ (lúc nào, ai huỷ, lý do). */
export function OrderStepper({ status, timeline, viewer }: OrderStepperProps) {
  if (status === 'CANCELLED') {
    const cancel = timeline.findLast((t) => t.toStatus === 'CANCELLED')
    return (
      <section className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200">
          <CircleX className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">Đơn hàng đã bị huỷ</h2>
          {cancel && (
            <p className="mt-1 text-sm text-slate-600">
              Lúc {formatDateTime(cancel.createdAt)} · {actorLabel(cancel, viewer)} huỷ
              {cancel.note && <> · “{cancel.note}”</>}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">Các sản phẩm trong đơn đã được trả lại kho.</p>
        </div>
      </section>
    )
  }

  const current = ORDER_STEPS.indexOf(status)
  const reachedAt = (step: OrderStatus) => timeline.find((t) => t.toStatus === step)?.createdAt

  return (
    <section aria-label="Tiến trình đơn hàng" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <ol className="grid grid-cols-3 gap-y-6 sm:grid-cols-6">
        {ORDER_STEPS.map((step, index) => {
          const done = index < current
          const active = index === current
          const at = reachedAt(step)
          return (
            <li key={step} className="relative flex flex-col items-center px-1 text-center">
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-5 right-1/2 hidden h-0.5 w-full -translate-y-1/2 sm:block',
                    index <= current ? 'bg-brand-600' : 'bg-slate-200',
                  )}
                />
              )}
              <span
                className={cn(
                  'relative flex size-10 items-center justify-center rounded-full text-sm font-semibold ring-4',
                  done && 'bg-brand-600 text-white ring-white',
                  active && 'bg-brand-600 text-white ring-brand-100',
                  !done && !active && 'bg-slate-100 text-slate-400 ring-white',
                )}
              >
                {done ? <Check className="size-5" aria-hidden /> : index + 1}
              </span>
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'mt-2 text-sm font-medium',
                  active ? 'text-brand-700' : done ? 'text-slate-900' : 'text-slate-400',
                )}
              >
                {STEP_LABELS[step]}
              </span>
              <span className="mt-0.5 text-xs text-slate-500">{at ? formatDateTime(at) : '—'}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
