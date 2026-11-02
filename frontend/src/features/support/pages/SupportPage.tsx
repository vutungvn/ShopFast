import { ChevronRight, MessageCircleQuestion, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { PATHS, supportTicketPath } from '@/app/paths'
import { getErrorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { openChatWidget } from '../chat-widget'
import { CategoryBadge, TicketStatusBadge } from '../components/SupportBadges'
import { useTickets } from '../queries'

const PAGE_SIZE = 10

/** Danh sách yêu cầu hỗ trợ của khách */
export function SupportPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const tickets = useTickets({ page, limit: PAGE_SIZE })
  const meta = tickets.data?.meta

  return (
    <>
      <title>Hỗ trợ · ShopFast</title>
      <Breadcrumb items={[{ label: 'Trang chủ', to: PATHS.home }, { label: 'Hỗ trợ' }]} />
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Hỗ trợ khách hàng</h1>
          <p className="mt-1 text-sm text-slate-500">
            Trợ lý AI trả lời ngay về đơn hàng, sản phẩm; nhân viên CSKH hỗ trợ khi cần.
          </p>
        </div>
        <Button onClick={() => openChatWidget({ fresh: true })}>
          <Plus className="size-4.5" aria-hidden />
          Chat mới với trợ lý AI
        </Button>
      </div>

      <div className={cn('mt-6 space-y-3 transition-opacity', tickets.isPlaceholderData && 'opacity-60')}>
        {tickets.isPending ? (
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))
        ) : tickets.isError ? (
          <Alert variant="error">Không tải được yêu cầu hỗ trợ. {getErrorMessage(tickets.error)}</Alert>
        ) : tickets.data.items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <EmptyState
              icon={MessageCircleQuestion}
              title="Bạn chưa có yêu cầu hỗ trợ nào"
              description="Hỏi về tình trạng đơn, giao hàng, sản phẩm hoặc yêu cầu huỷ đơn."
              action={
                <Button onClick={() => openChatWidget({ fresh: true })}>Chat với trợ lý AI</Button>
              }
            />
          </div>
        ) : (
          tickets.data.items.map((ticket) => (
            <Link
              key={ticket.id}
              to={supportTicketPath(ticket.id)}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30 sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-slate-900">{ticket.subject}</p>
                  <TicketStatusBadge status={ticket.status} />
                  <CategoryBadge category={ticket.category} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {ticket.orderCode && <>Đơn {ticket.orderCode} · </>}
                  Cập nhật {formatDateTime(ticket.updatedAt)}
                  {ticket.pendingActions > 0 && (
                    <span className="text-amber-700"> · {ticket.pendingActions} yêu cầu chờ duyệt</span>
                  )}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden />
            </Link>
          ))
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onChange={(p) => setParams(p > 1 ? { page: String(p) } : {})}
          />
        </div>
      )}
    </>
  )
}
