import { History } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { STATUS_STYLES, STEP_LABELS } from '../order-status'
import { actorLabel } from '../timeline'
import type { TimelineEntry } from '../types'

const ACTOR_STYLES = {
  CUSTOMER: 'bg-sky-50 text-sky-700',
  STAFF: 'bg-brand-50 text-brand-700',
  SYSTEM: 'bg-slate-100 text-slate-600',
}

type OrderTimelineProps = {
  timeline: TimelineEntry[]
  viewer: 'customer' | 'staff'
  title?: string
}

/** Lịch sử trạng thái, mới nhất ở trên */
export function OrderTimeline({ timeline, viewer, title = 'Lịch sử đơn hàng' }: OrderTimelineProps) {
  const entries = [...timeline].reverse()

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <History className="size-5 text-brand-600" aria-hidden />
          {title}
        </h2>
        <span className="text-sm text-slate-500">{entries.length} sự kiện</span>
      </div>

      <ol className="mt-5">
        {entries.map((entry, index) => (
          <li key={`${entry.toStatus}-${entry.createdAt}`} className="relative flex gap-4 pb-6 last:pb-0">
            {index < entries.length - 1 && (
              <span className="absolute top-4 left-[7px] h-full w-px bg-slate-200" aria-hidden />
            )}
            <span
              className={cn(
                'relative mt-1 size-[15px] shrink-0 rounded-full ring-4',
                index === 0 ? 'ring-brand-100' : 'ring-white',
                STATUS_STYLES[entry.toStatus].dot,
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-slate-900">
                  {entry.fromStatus === null ? 'Đặt hàng' : STEP_LABELS[entry.toStatus]}
                </span>
                <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', ACTOR_STYLES[entry.actor])}>
                  {actorLabel(entry, viewer)}
                </span>
                <span className="ml-auto text-xs text-slate-500">{formatDateTime(entry.createdAt)}</span>
              </div>
              {entry.note && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{entry.note}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
