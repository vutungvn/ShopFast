import { ShieldCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useConnectionState } from '@/api/socket'
import { staffOrderPath, staffTicketPath } from '@/app/paths'
import { getErrorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { LiveBadge } from '@/features/orders/components/LiveBadge'
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { ActionReview } from '../components/ActionReview'
import { ActionStatusBadge } from '../components/SupportBadges'
import { ACTION_STATUS, ACTION_TYPE_LABELS } from '../labels'
import { useAgentActions } from '../queries'
import type { AgentActionStatus } from '../types'

const PAGE_SIZE = 10
const TABS: Array<AgentActionStatus | null> = ['PENDING', 'EXECUTED', 'REJECTED', 'FAILED', null]

/** Hàng đợi duyệt các thao tác ghi do trợ lý AI đề xuất (human-in-the-loop) */
export function AgentActionsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('status')
  const status = raw === 'all' ? null : (TABS.find((s) => s === raw) ?? 'PENDING')
  const page = Math.max(1, Number(params.get('page')) || 1)
  const actions = useAgentActions({ status: status ?? undefined, page, limit: PAGE_SIZE })
  const meta = actions.data?.meta
  const live = useConnectionState()

  const go = (nextStatus: AgentActionStatus | null, nextPage = 1) => {
    const search = new URLSearchParams()
    if (nextStatus !== 'PENDING') search.set('status', nextStatus ?? 'all')
    if (nextPage > 1) search.set('page', String(nextPage))
    setParams(search)
  }

  return (
    <>
      <title>Duyệt đề xuất AI · ShopFast</title>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Duyệt đề xuất của trợ lý AI</h1>
        <LiveBadge state={live} />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Trợ lý AI không tự thay đổi dữ liệu: mọi yêu cầu huỷ đơn chỉ được thực hiện sau khi nhân viên duyệt.
      </p>

      <nav aria-label="Lọc theo trạng thái" className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
        {TABS.map((s) => (
          <button
            key={s ?? 'all'}
            type="button"
            onClick={() => go(s)}
            aria-current={s === status ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              s === status ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            {s ? ACTION_STATUS[s].label : 'Tất cả'}
          </button>
        ))}
      </nav>

      <div className={cn('mt-5 space-y-3', actions.isPlaceholderData && 'opacity-60')}>
        {actions.isPending ? (
          <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ) : actions.isError ? (
          <Alert variant="error">Không tải được đề xuất. {getErrorMessage(actions.error)}</Alert>
        ) : actions.data.items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <EmptyState
              icon={ShieldCheck}
              title={status === 'PENDING' ? 'Không có đề xuất nào chờ duyệt' : 'Không có đề xuất nào'}
            />
          </div>
        ) : (
          actions.data.items.map((action) => (
            <article key={action.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-slate-900">
                  {ACTION_TYPE_LABELS[action.type] ?? action.type}{' '}
                  {action.orderId ? (
                    <Link to={staffOrderPath(action.orderId)} className="text-brand-700 hover:underline">
                      {action.orderCode}
                    </Link>
                  ) : (
                    action.orderCode
                  )}
                </h2>
                {action.orderStatus && <OrderStatusBadge status={action.orderStatus} />}
                <span className="ml-auto">
                  <ActionStatusBadge status={action.status} />
                </span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="inline">Khách: </dt>
                  <dd className="inline font-medium text-slate-900">{action.customerName}</dd>
                </div>
                <div>
                  <dt className="inline">Hội thoại: </dt>
                  <dd className="inline">
                    <Link to={staffTicketPath(action.ticketId)} className="text-brand-700 hover:underline">
                      {action.ticketSubject}
                    </Link>
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline">Lý do AI ghi nhận: </dt>
                  <dd className="inline text-slate-900">{action.reason ?? '—'}</dd>
                </div>
                <div>
                  <dt className="inline">Đề xuất lúc: </dt>
                  <dd className="inline">{formatDateTime(action.createdAt)}</dd>
                </div>
                {action.reviewedAt && (
                  <div>
                    <dt className="inline">Xử lý: </dt>
                    <dd className="inline">
                      {action.reviewerName} · {formatDateTime(action.reviewedAt)}
                    </dd>
                  </div>
                )}
                {action.note && (
                  <div className="sm:col-span-2">
                    <dt className="inline">Ghi chú: </dt>
                    <dd className="inline">{action.note}</dd>
                  </div>
                )}
              </dl>
              {action.status === 'PENDING' && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <ActionReview actionId={action.id} orderCode={action.orderCode} />
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination page={meta.page} totalPages={meta.totalPages} onChange={(p) => go(status, p)} />
        </div>
      )}
    </>
  )
}
