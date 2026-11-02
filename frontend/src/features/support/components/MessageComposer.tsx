import { SendHorizontal } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { getErrorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { useRetryAfter } from '@/hooks/useRetryAfter'
import { formatCountdown } from '@/lib/format'
import { MAX_MESSAGE } from '../labels'

type MessageComposerProps = {
  onSend: (content: string) => Promise<unknown>
  sending: boolean
  placeholder: string
  /** Có giá trị thì khoá ô nhập và hiện lý do (vd yêu cầu đã đóng) */
  closedText?: string
  /** Câu hỏi mẫu: bấm là gửi luôn */
  suggestions?: string[]
}

/** Ô soạn tin: Enter để gửi, Shift+Enter xuống dòng */
export function MessageComposer({ onSend, sending, placeholder, closedText, suggestions }: MessageComposerProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const retry = useRetryAfter()
  const blocked = retry.secondsLeft > 0

  if (closedText) {
    return <p className="border-t border-slate-100 px-5 py-4 text-center text-sm text-slate-500">{closedText}</p>
  }

  const submit = async (e?: FormEvent, preset?: string) => {
    e?.preventDefault()
    const content = (preset ?? text).trim()
    if (!content || sending || blocked) return
    setError(null)
    // Xoá ô nhập ngay (tin hiện trong khung chat lúc chờ); lỗi thì trả lại nội dung
    setText('')
    try {
      await onSend(content)
    } catch (err) {
      setText(content)
      if (!retry.track(err)) setError(getErrorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-100 p-4">
      {blocked && (
        <Alert variant="warning" className="mb-3">
          Bạn gửi tin nhắn quá nhanh. Gửi lại sau {formatCountdown(retry.secondsLeft)}.
        </Alert>
      )}
      {error && (
        <Alert variant="error" className="mb-3">
          {error}
        </Alert>
      )}
      {suggestions && !sending && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={blocked}
              onClick={() => void submit(undefined, suggestion)}
              className="rounded-full border border-brand-200 bg-brand-50/50 px-3 py-1 text-xs text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void submit()
            }
          }}
          rows={2}
          maxLength={MAX_MESSAGE}
          placeholder={placeholder}
          aria-label="Nội dung tin nhắn"
          className="block min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
        />
        <Button type="submit" loading={sending} disabled={!text.trim() || blocked} aria-label="Gửi">
          <SendHorizontal className="size-4.5" aria-hidden />
          <span className="hidden sm:inline">Gửi</span>
        </Button>
      </div>
    </form>
  )
}
