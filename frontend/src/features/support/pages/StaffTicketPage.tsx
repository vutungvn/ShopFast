import { Bot, Headset } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useConnectionState } from '@/api/socket'
import { PATHS, staffOrderPath } from '@/app/paths'
import { getErrorMessage, getErrorStatus } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { buttonClasses } from '@/components/ui/button-styles'
import { LiveBadge } from '@/features/orders/components/LiveBadge'
import { formatDateTime } from '@/lib/format'
import { ActionReview } from '../components/ActionReview'
import { Conversation } from '../components/Conversation'
import { MessageComposer } from '../components/MessageComposer'
import { ActionStatusBadge, CategoryBadge, TicketStatusBadge } from '../components/SupportBadges'
import { ACTION_TYPE_LABELS, CATEGORIES, CATEGORY_LABELS, TICKET_STATUS, TICKET_STATUSES } from '../labels'
import { useHandBack, useSendMessage, useTicket, useUpdateTicket } from '../queries'
import type { TicketCategory, TicketStatus } from '../types'

const selectClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-60'

/** CSKH xem hội thoại, trả lời (tiếp nhận, AI thôi trả lời), đổi trạng thái / nhóm, duyệt đề xuất của AI */
export function StaffTicketPage() {
  const { id = '' } = useParams()
  const query = useTicket(id)
  const send = useSendMessage(id)
  const update = useUpdateTicket(id)
  const handBack = useHandBack(id)
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
            <Link to={PATHS.staffTickets} className={buttonClasses('outline', 'sm', 'mt-4')}>
              Về danh sách
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
      <Breadcrumb items={[{ label: 'Hỗ trợ khách hàng', to: PATHS.staffTickets }, { label: ticket.subject }]} />

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
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
                  Trợ lý AI đang tự trả lời. Bạn trả lời thì AI dừng.
                </>
              ) : (
                <>
                  <Headset className="size-4" aria-hidden />
                  Nhân viên đã tiếp nhận, AI không tự trả lời
                </>
              )}
            </p>
            {!ticket.aiActive && !closed && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  loading={handBack.isPending}
                  onClick={() => handBack.mutate()}
                  title="Bỏ người xử lý, chuyển về Mới; trợ lý AI trả lời từ tin sau của khách"
                >
                  <Bot className="size-4" aria-hidden />
                  Trả lại cho trợ lý AI
                </Button>
                {handBack.isError && (
                  <Alert variant="error" className="mt-2">
                    {getErrorMessage(handBack.error)}
                  </Alert>
                )}
              </div>
            )}
          </header>
          <Conversation
            messages={ticket.messages}
            viewer="staff"
            pending={send.isPending ? send.variables : undefined}
          />
          <MessageComposer
            onSend={(content) => send.mutateAsync(content)}
            sending={send.isPending}
            placeholder="Trả lời khách… (Enter để gửi)"
            closedText={closed ? 'Yêu cầu đã đóng. Đổi trạng thái về "Đang xử lý" để trả lời tiếp.' : undefined}
          />
        </section>

        <aside className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <h2 className="font-semibold text-slate-900">Thông tin</h2>
            <dl className="space-y-2 text-slate-600">
              <div className="flex justify-between gap-3">
                <dt>Khách hàng</dt>
                <dd className="text-right font-medium text-slate-900">{ticket.customerName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Tạo lúc</dt>
                <dd className="text-slate-900">{formatDateTime(ticket.createdAt)}</dd>
              </div>
              {ticket.orderId && ticket.orderCode && (
                <div className="flex justify-between gap-3">
                  <dt>Đơn liên quan</dt>
                  <dd>
                    <Link to={staffOrderPath(ticket.orderId)} className="font-medium text-brand-700 hover:underline">
                      {ticket.orderCode}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
            <label className="block">
              <span className="mb-1 block text-slate-600">Trạng thái</span>
              <select
                value={ticket.status}
                disabled={update.isPending}
                onChange={(e) => update.mutate({ status: e.target.value as TicketStatus })}
                className={selectClass}
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TICKET_STATUS[s].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">Nhóm (AI phân loại, sửa được)</span>
              <select
                value={ticket.category ?? 'OTHER'}
                disabled={update.isPending}
                onChange={(e) => update.mutate({ category: e.target.value as TicketCategory })}
                className={selectClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            {update.isError && <Alert variant="error">{getErrorMessage(update.error)}</Alert>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Đề xuất của trợ lý AI</h2>
            {ticket.actions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Chưa có đề xuất nào.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {ticket.actions.map((action) => (
                  <li key={action.id} className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {ACTION_TYPE_LABELS[action.type] ?? action.type} {action.orderCode}
                      </span>
                      <ActionStatusBadge status={action.status} />
                    </div>
                    {action.reason && <p className="text-slate-600">Lý do của khách: {action.reason}</p>}
                    {action.note && <p className="text-slate-500">Ghi chú: {action.note}</p>}
                    {action.status === 'PENDING' && <ActionReview actionId={action.id} orderCode={action.orderCode} />}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
