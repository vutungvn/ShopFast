import { MessageCircleQuestion } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useConnectionState } from '@/api/socket'
import { staffTicketPath } from '@/app/paths'
import { getErrorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { LiveBadge } from '@/features/orders/components/LiveBadge'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { CategoryBadge, TicketStatusBadge } from '../components/SupportBadges'
import { CATEGORIES, CATEGORY_LABELS, TICKET_STATUS, TICKET_STATUSES } from '../labels'
import { useTickets } from '../queries'
import type { TicketCategory, TicketStatus } from '../types'

const PAGE_SIZE = 20

/** Hàng đợi yêu cầu hỗ trợ cho CSKH / admin */
export function StaffTicketsPage() {
  const [params, setParams] = useSearchParams()
  const status = TICKET_STATUSES.find((s) => s === params.get('status'))
  const category = CATEGORIES.find((c) => c === params.get('category'))
  const page = Math.max(1, Number(params.get('page')) || 1)
  const tickets = useTickets({ status, category, page, limit: PAGE_SIZE })
  const meta = tickets.data?.meta
  const live = useConnectionState()

  const go = (next: { status?: TicketStatus | null; category?: TicketCategory | null; page?: number }) => {
    const search = new URLSearchParams()
    const nextStatus = next.status === undefined ? status : next.status
    const nextCategory = next.category === undefined ? category : next.category
    if (nextStatus) search.set('status', nextStatus)
    if (nextCategory) search.set('category', nextCategory)
    if (next.page && next.page > 1) search.set('page', String(next.page))
    setParams(search)
  }

  return (
    <>
      <title>Hỗ trợ khách hàng · ShopFast</title>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hỗ trợ khách hàng</h1>
        <LiveBadge state={live} />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Trợ lý AI tự trả lời yêu cầu mới; trả lời trong hội thoại để tiếp nhận và tắt AI.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <nav aria-label="Lọc theo trạng thái" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
          {[null, ...TICKET_STATUSES].map((s) => (
            <button
              key={s ?? 'all'}
              type="button"
              onClick={() => go({ status: s, page: 1 })}
              aria-current={s === (status ?? null) ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                s === (status ?? null) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {s ? TICKET_STATUS[s].label : 'Tất cả'}
            </button>
          ))}
        </nav>
        <select
          value={category ?? ''}
          onChange={(e) => go({ category: (e.target.value || null) as TicketCategory | null, page: 1 })}
          aria-label="Lọc theo nhóm"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
        >
          <option value="">Mọi nhóm</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className={cn('mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white', tickets.isPlaceholderData && 'opacity-60')}>
        {tickets.isPending ? (
          <div className="h-64 animate-pulse bg-slate-50" />
        ) : tickets.isError ? (
          <div className="p-5">
            <Alert variant="error">Không tải được yêu cầu hỗ trợ. {getErrorMessage(tickets.error)}</Alert>
          </div>
        ) : tickets.data.items.length === 0 ? (
          <EmptyState icon={MessageCircleQuestion} title="Không có yêu cầu nào" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {tickets.data.items.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  to={staffTicketPath(ticket.id)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-slate-900">{ticket.subject}</span>
                      {ticket.pendingActions > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {ticket.pendingActions} đề xuất chờ duyệt
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {ticket.customerName}
                      {ticket.orderCode && ` · Đơn ${ticket.orderCode}`} · {formatDateTime(ticket.updatedAt)}
                    </p>
                  </div>
                  <CategoryBadge category={ticket.category} />
                  <TicketStatusBadge status={ticket.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination page={meta.page} totalPages={meta.totalPages} onChange={(p) => go({ page: p })} />
        </div>
      )}
    </>
  )
}
