import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Đang gửi request: khoá nút và hiện vòng quay */
  loading?: boolean
  /** Chữ hiển thị khi đang loading, mặc định giữ nguyên chữ của nút */
  loadingText?: string
}

export function Button({
  loading = false,
  loadingText,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 font-semibold text-white transition-colors',
        'hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-brand-600',
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}
