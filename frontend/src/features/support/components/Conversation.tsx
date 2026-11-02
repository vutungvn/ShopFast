import { Bot, Headset, UserRound } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import type { MessageSender, TicketMessage } from '../types'

type ConversationProps = {
  messages: TicketMessage[]
  viewer: 'customer' | 'staff'
  /** Tin vừa gửi, chưa có phản hồi từ máy chủ */
  pending?: string
  /** Hiện "Trợ lý AI đang trả lời…" */
  typing?: boolean
  /** Lời chào của trợ lý ở đầu khung (chưa phải tin đã lưu) */
  intro?: string
  /** Kích thước khung cuộn */
  className?: string
}

const SENDERS: Record<MessageSender, { label: string; Icon: typeof Bot; avatar: string }> = {
  AI: { label: 'Trợ lý AI', Icon: Bot, avatar: 'bg-brand-100 text-brand-700' },
  STAFF: { label: 'Nhân viên CSKH', Icon: Headset, avatar: 'bg-emerald-100 text-emerald-700' },
  CUSTOMER: { label: 'Khách hàng', Icon: UserRound, avatar: 'bg-slate-200 text-slate-600' },
}

/** Khung hội thoại của ticket: tin của người đang xem nằm bên phải */
export function Conversation({
  messages,
  viewer,
  pending,
  typing,
  intro,
  className = 'max-h-[60vh] min-h-64',
}: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const mine: MessageSender = viewer === 'customer' ? 'CUSTOMER' : 'STAFF'
  // Realtime có thể tải về tin vừa gửi trước khi request gửi xong: khi đó không hiện thêm bản "Đang gửi…"
  const last = messages.at(-1)
  const showPending = pending && !(last?.senderType === mine && last.content === pending)

  // Có tin mới thì cuộn xuống cuối
  useEffect(() => {
    const box = scrollRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [messages.length, pending, typing])

  return (
    <div ref={scrollRef} className={cn('space-y-4 overflow-y-auto p-4 sm:p-5', className)} aria-live="polite">
      {intro && <Bubble sender="AI" content={intro} mine={false} />}
      {messages.map((message) => (
        <Bubble
          key={message.id}
          sender={message.senderType}
          name={message.senderName}
          content={message.content}
          time={formatDateTime(message.createdAt)}
          mine={message.senderType === mine}
        />
      ))}
      {showPending && <Bubble sender={mine} content={pending} time="Đang gửi…" mine />}
      {typing && (
        <div className="flex items-center gap-2.5 text-sm text-slate-500">
          <Avatar sender="AI" />
          <span className="flex items-center gap-1 rounded-2xl bg-slate-100 px-3.5 py-2.5">
            Trợ lý AI đang trả lời
            <span className="flex gap-0.5" aria-hidden>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

function Avatar({ sender }: { sender: MessageSender }) {
  const { Icon, avatar } = SENDERS[sender]
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', avatar)}>
      <Icon className="size-4.5" aria-hidden />
    </span>
  )
}

type BubbleProps = {
  sender: MessageSender
  name?: string | null
  content: string
  time?: string
  mine: boolean
}

function Bubble({ sender, name, content, time, mine }: BubbleProps) {
  const label = sender === 'AI' ? SENDERS.AI.label : (name ?? SENDERS[sender].label)
  return (
    <div className={cn('flex items-end gap-2.5', mine && 'flex-row-reverse')}>
      <Avatar sender={sender} />
      <div className={cn('max-w-[80%]', mine && 'text-right')}>
        <p className="mb-1 text-xs text-slate-500">
          {mine ? 'Bạn' : label}
          {sender === 'STAFF' && !mine && ' · Nhân viên CSKH'}
          {time && <span className="text-slate-400"> · {time}</span>}
        </p>
        <div
          className={cn(
            'inline-block rounded-2xl px-3.5 py-2.5 text-left text-sm whitespace-pre-line',
            mine
              ? 'rounded-br-md bg-brand-600 text-white'
              : sender === 'AI'
                ? 'rounded-bl-md bg-brand-50 text-slate-800 ring-1 ring-brand-100'
                : 'rounded-bl-md bg-slate-100 text-slate-800',
          )}
        >
          {content}
        </div>
      </div>
    </div>
  )
}
