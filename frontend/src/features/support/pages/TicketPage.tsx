import { Bot, Headset } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useConnectionState } from '@/api/socket'
import { orderPath, PATHS } from '@/app/paths'
import { getErrorMessage, getErrorStatus } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { buttonClasses } from '@/components/ui/button-styles'
import { LiveBadge } from '@/features/orders/components/LiveBadge'
import { formatDateTime } from '@/lib/format'
import { Conversation } from '../components/Conversation'
import { MessageComposer } from '../components/MessageComposer'
import { ActionStatusBadge, CategoryBadge, TicketStatusBadge } from '../components/SupportBadges'
import { ACTION_TYPE_LABELS } from '../labels'
import { useSendMessage, useTicket } from '../queries'

/** Hội thoại của khách với trợ lý AI / nhân viên CSKH */
export function TicketPage() {
  const { id = '' } = useParams()
  const query = useTicket(id)
  const send = useSendMessage(id)
  const live = useConnectionState()
  const ticket = query.data

  if (!ticket) {
    return (
      <div className="mx-auto mt-10 max-w-lg text-center">
        {query.isPending ? (
          <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ) : (
          <>
            <Alert variant="error">
              {getErrorStatus(query.error) === 404
                ? 'Không tìm thấy yêu cầu hỗ trợ'
                : `Không tải được yêu cầu. ${getErrorMessage(query.error)}`}
            </Alert>
            <Link to={PATHS.support} className={buttonClasses('outline', 'sm', 'mt-4')}>
              Về danh sách hỗ trợ
            </Link>
          </>
        )}
      </div>
    )
  }

  const closed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'

  return (
    <>
      <title>{`${ticket.subject} · Hỗ trợ · ShopFast`}</title>
      <Breadcrumb
        items={[
          { label: 'Trang chủ', to: PATHS.home },
          { label: 'Hỗ trợ', to: PATHS.support },
          { label: ticket.subject },
        ]}
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">{ticket.subject}</h1>
              <TicketStatusBadge status={ticket.status} />
              <CategoryBadge category={ticket.category} />
              <LiveBadge state={live} />
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              {ticket.aiActive ? (
                <>
                  <Bot className="size-4" aria-hidden />
                  Trợ lý AI đang trả lời tự động
                </>
              ) : closed ? (
                'Yêu cầu đã được xử lý'
              ) : (
                <>
                  <Headset className="size-4" aria-hidden />
                  Nhân viên CSKH đang hỗ trợ bạn
                </>
              )}
            </p>
          </header>
          <Conversation
            messages={ticket.messages}
            viewer="customer"
            pending={send.isPending ? send.variables : undefined}
            typing={send.isPending && ticket.aiActive}
          />
          <MessageComposer
            onSend={(content) => send.mutateAsync(content)}
            sending={send.isPending}
            placeholder="Nhập câu hỏi… (Enter để gửi)"
            closedText={closed ? 'Yêu cầu đã đóng. Tạo yêu cầu mới nếu bạn cần hỗ trợ thêm.' : undefined}
          />
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <h2 className="font-semibold text-slate-900">Thông tin</h2>
            <dl className="mt-3 space-y-2 text-slate-600">
              <div className="flex justify-between gap-3">
                <dt>Tạo lúc</dt>
                <dd className="text-slate-900">{formatDateTime(ticket.createdAt)}</dd>
              </div>
              {ticket.orderId && ticket.orderCode && (
                <div className="flex justify-between gap-3">
                  <dt>Đơn liên quan</dt>
                  <dd>
                    <Link to={orderPath(ticket.orderId)} className="font-medium text-brand-700 hover:underline">
                      {ticket.orderCode}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {ticket.actions.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Yêu cầu gửi nhân viên duyệt</h2>
              <ul className="mt-3 space-y-3">
                {ticket.actions.map((action) => (
                  <li key={action.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {ACTION_TYPE_LABELS[action.type] ?? action.type} {action.orderCode}
                      </span>
                      <ActionStatusBadge status={action.status} />
                    </div>
                    {action.reason && <p className="mt-1 text-slate-500">Lý do: {action.reason}</p>}
                    {action.note && <p className="mt-1 text-slate-500">Phản hồi: {action.note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  )
}
