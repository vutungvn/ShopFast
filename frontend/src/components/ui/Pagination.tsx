import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

type PaginationProps = {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

/** 1 … 4 5 6 … 10: luôn có trang đầu, trang cuối và các trang kề trang hiện tại */
function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['gap' as const, p] : [p]))
}

const itemClass =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Phân trang" className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={cn(itemClass, 'gap-1 text-slate-600 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40')}
      >
        <ChevronLeft className="size-4" aria-hidden />
        <span className="hidden sm:inline">Trước</span>
      </button>

      {pageWindow(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-slate-400" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Trang ${item}`}
            className={cn(
              itemClass,
              item === page ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100',
            )}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={cn(itemClass, 'gap-1 text-slate-600 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40')}
      >
        <span className="hidden sm:inline">Sau</span>
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  )
}
