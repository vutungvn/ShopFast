import { Bot, Headset, Maximize2, SquarePen, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useConnectionState } from '@/api/socket'
import { supportTicketPath } from '@/app/paths'
import { Button } from '@/components/ui/Button'
import { LiveBadge } from '@/features/orders/components/LiveBadge'
import { closeChatWidget, openChatWidget, useChatWidget, type ChatOrder } from '../chat-widget'
import { ACTION_TYPE_LABELS } from '../labels'
import { useCreateTicket, useOpenTicket, useSendMessage, useTicket } from '../queries'
import { Conversation } from './Conversation'
import { MessageComposer } from './MessageComposer'
import { ActionStatusBadge } from './SupportBadges'

const WELCOME =
  'Xin chào! Em là trợ lý AI của ShopFast. Em có thể tra tình trạng đơn hàng, kiểm tra tồn kho sản phẩm hoặc gửi yêu cầu huỷ đơn giúp anh/chị.'
const SUGGESTIONS = ['Đơn hàng gần nhất của tôi đang ở đâu?', 'Tôi muốn huỷ đơn', 'Sản phẩm còn hàng không?']
const ORDER_SUGGESTIONS = ['Đơn này đang ở đâu?', 'Tôi muốn huỷ đơn này']
const SUBJECT_LENGTH = 80

/** Tiêu đề yêu cầu tự đặt từ tin đầu tiên (khách không phải nhập) */
function subjectOf(message: string, order: ChatOrder | null) {
  if (order) return `Hỗ trợ đơn ${order.code}`
  const line = message.split('\n')[0]
  return line.length > SUBJECT_LENGTH ? `${line.slice(0, SUBJECT_LENGTH - 1)}…` : line
}

/** Bong bóng chat góc màn hình (khách đã đăng nhập); bấm mở cửa sổ chat với trợ lý AI */
export function SupportChatWidget() {
  const { open, order, fresh, session } = useChatWidget()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => openChatWidget()}
        aria-label="Chat với trợ lý AI"
        className="fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-full bg-brand-600 p-3.5 text-white shadow-lg shadow-brand-600/30 transition-colors hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none sm:right-6 sm:bottom-6"
      >
        <Bot className="size-6" aria-hidden />
        <span className="hidden pr-1 text-sm font-medium sm:inline">Hỏi trợ lý AI</span>
      </button>
    )
  }
  // Mỗi lần mở là một phiên mới: tìm lại cuộc trò chuyện đang mở (của đơn đang hỏi nếu có)
  return <ChatPanel key={session} order={order} fresh={fresh} />
}

function ChatPanel({ order, fresh }: { order: ChatOrder | null; fresh: boolean }) {
  // Cuộc trò chuyện còn mở gần nhất (của đơn này nếu mở từ trang đơn) => nói tiếp, không tạo yêu cầu mới
  const latest = useOpenTicket(order?.orderId)
  const live = useConnectionState()
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [startNew, setStartNew] = useState(fresh)
  const ticketId = createdId ?? (startNew ? null : (latest.data?.id ?? null))
  const ticket = useTicket(ticketId ?? '', ticketId !== null).data
  const create = useCreateTicket()
  const send = useSendMessage(ticketId ?? '')

  const closed = ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED'
  const sending = create.isPending || send.isPending
  const pending = create.isPending ? create.variables?.message : send.isPending ? send.variables : undefined
  const loading = ticketId === null ? latest.isPending && !startNew : !ticket

  const handleSend = async (content: string) => {
    if (ticketId) {
      await send.mutateAsync(content)
      return
    }
    // Tin đầu tiên: tạo yêu cầu, AI trả lời luôn trong response
    const created = await create.mutateAsync({
      subject: subjectOf(content, order),
      message: content,
      orderId: order?.orderId,
    })
    setCreatedId(created.id)
  }

  const newConversation = () => {
    setCreatedId(null)
    setStartNew(true)
  }

  return (
    <section
      aria-label="Chat với trợ lý AI"
      className="fixed inset-x-2 bottom-2 z-40 flex h-[min(640px,calc(100dvh-1rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
    >
      <header className="flex items-center gap-3 bg-brand-600 px-4 py-3 text-white">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Bot className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            Trợ lý AI ShopFast
            <LiveBadge state={live} className="px-2 py-0 text-[11px]" />
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-white/80">
            {ticket && !ticket.aiActive && !closed ? (
              <>
                <Headset className="size-3.5" aria-hidden />
                Nhân viên CSKH đang hỗ trợ
              </>
            ) : order ? (
              `Hỏi về đơn ${order.code}`
            ) : (
              'Trả lời tự động 24/7'
            )}
          </p>
        </div>
        {ticketId && (
          <>
            <button
              type="button"
              onClick={newConversation}
              aria-label="Cuộc trò chuyện mới"
              title="Cuộc trò chuyện mới"
              className="rounded-lg p-1.5 hover:bg-white/15"
            >
              <SquarePen className="size-4.5" aria-hidden />
            </button>
            <Link
              to={supportTicketPath(ticketId)}
              onClick={closeChatWidget}
              aria-label="Mở toàn trang"
              title="Mở toàn trang"
              className="rounded-lg p-1.5 hover:bg-white/15"
            >
              <Maximize2 className="size-4.5" aria-hidden />
            </Link>
          </>
        )}
        <button
          type="button"
          onClick={closeChatWidget}
          aria-label="Đóng cửa sổ chat"
          className="rounded-lg p-1.5 hover:bg-white/15"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      {loading ? (
        <div className="flex-1 animate-pulse bg-slate-50" />
      ) : (
        <Conversation
          className="min-h-0 flex-1"
          viewer="customer"
          intro={ticketId ? undefined : WELCOME}
          messages={ticket?.messages ?? []}
          pending={pending}
          typing={create.isPending || (send.isPending && ticket?.aiActive)}
        />
      )}

      {ticket?.actions.some((action) => action.status === 'PENDING') && (
        <ul className="space-y-1.5 border-t border-slate-100 bg-amber-50/60 px-4 py-2.5 text-xs">
          {ticket.actions
            .filter((action) => action.status === 'PENDING')
            .map((action) => (
              <li key={action.id} className="flex items-center justify-between gap-2 text-slate-700">
                {ACTION_TYPE_LABELS[action.type] ?? action.type} {action.orderCode}
                <ActionStatusBadge status={action.status} />
              </li>
            ))}
        </ul>
      )}

      {closed ? (
        <div className="border-t border-slate-100 p-4 text-center text-sm text-slate-500">
          Cuộc trò chuyện đã kết thúc.
          <Button size="sm" className="mt-3 w-full" onClick={newConversation}>
            Bắt đầu cuộc trò chuyện mới
          </Button>
        </div>
      ) : (
        <MessageComposer
          onSend={handleSend}
          sending={sending}
          placeholder="Nhập câu hỏi… (Enter để gửi)"
          suggestions={ticketId || loading ? undefined : order ? ORDER_SUGGESTIONS : SUGGESTIONS}
        />
      )}
    </section>
  )
}
