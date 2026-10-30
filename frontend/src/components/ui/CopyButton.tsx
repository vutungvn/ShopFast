import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'

/** Nút nhỏ sao chép một chuỗi (mã đơn, số điện thoại); đổi thành dấu tích trong 1.5 giây */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Trình duyệt chặn clipboard: bỏ qua, người dùng vẫn bôi đen được
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Đã sao chép' : label}
      title={copied ? 'Đã sao chép' : label}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600',
        copied && 'text-emerald-600 hover:text-emerald-600',
        className,
      )}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
    </button>
  )
}
