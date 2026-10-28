import { Search, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { PATHS } from '@/app/paths'
import { cn } from '@/lib/cn'

type HeaderSearchProps = {
  /** Từ khoá đang tìm (trên trang danh sách); cha đặt `key` theo giá trị này để đồng bộ */
  initialQuery: string
  className?: string
}

/** Tìm kiếm luôn trên toàn bộ sản phẩm: chuyển về trang danh sách với ?q= và bỏ các bộ lọc khác. */
export function HeaderSearch({ initialQuery, className }: HeaderSearchProps) {
  const navigate = useNavigate()
  const [value, setValue] = useState(initialQuery)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    navigate({ pathname: PATHS.home, search: q ? `?q=${encodeURIComponent(q)}` : '' })
  }

  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tìm theo tên sản phẩm hoặc mã SKU"
        aria-label="Tìm sản phẩm"
        maxLength={100}
        className="h-11 w-full rounded-xl border border-transparent bg-slate-100 pr-10 pl-10 text-sm text-slate-900 transition-colors outline-none placeholder:text-slate-400 hover:bg-slate-200/70 focus:border-brand-500 focus:bg-white focus:ring-3 focus:ring-brand-500/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          aria-label="Xoá từ khoá"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  )
}
