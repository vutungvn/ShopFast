import { cn } from '@/lib/cn'

/** Còn từ mức này trở xuống thì cảnh báo "Chỉ còn N sản phẩm" */
export const LOW_STOCK_THRESHOLD = 5

function stockInfo(stock: number) {
  if (stock <= 0) return { tone: 'out', label: 'Hết hàng' } as const
  if (stock <= LOW_STOCK_THRESHOLD) return { tone: 'low', label: `Chỉ còn ${stock} sản phẩm` } as const
  return { tone: 'ok', label: 'Còn hàng' } as const
}

const TONES = {
  ok: { text: 'text-emerald-700', dot: 'bg-emerald-500', pill: 'bg-emerald-50 ring-emerald-200' },
  low: { text: 'text-amber-700', dot: 'bg-amber-500', pill: 'bg-amber-50 ring-amber-200' },
  out: { text: 'text-slate-500', dot: 'bg-slate-400', pill: 'bg-slate-100 ring-slate-200' },
}

type StockStatusProps = {
  stock: number
  /** inline: chấm + chữ (thẻ sản phẩm); pill: nhãn có nền, kèm số lượng (trang chi tiết) */
  variant?: 'inline' | 'pill'
}

export function StockStatus({ stock, variant = 'inline' }: StockStatusProps) {
  const { tone, label } = stockInfo(stock)
  const styles = TONES[tone]
  const text = variant === 'pill' && tone === 'ok' ? `${label} · ${stock} sản phẩm` : label

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        styles.text,
        variant === 'pill' && cn('rounded-full px-3 py-1 text-sm ring-1 ring-inset', styles.pill),
      )}
    >
      <span className={cn('size-1.5 rounded-full', styles.dot)} aria-hidden />
      {text}
    </span>
  )
}
