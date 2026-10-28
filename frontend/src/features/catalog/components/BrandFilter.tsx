import { Search } from 'lucide-react'
import { useState } from 'react'
import type { Brand } from '../types'

const COLLAPSED_COUNT = 6

type BrandFilterProps = {
  brands: Brand[]
  selected: string[]
  onChange: (slugs: string[]) => void
}

export function BrandFilter({ brands, selected, onChange }: BrandFilterProps) {
  const [keyword, setKeyword] = useState('')
  const [showAll, setShowAll] = useState(false)

  const normalized = keyword.trim().toLowerCase()
  const matched = normalized
    ? brands.filter((b) => b.name.toLowerCase().includes(normalized))
    : brands
  // Thu gọn vẫn luôn hiện các thương hiệu đang chọn
  const visible =
    showAll || normalized
      ? matched
      : matched.filter((b, i) => i < COLLAPSED_COUNT || selected.includes(b.slug))
  const hiddenCount = matched.length - visible.length

  const toggle = (slug: string) =>
    onChange(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug])

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Tìm thương hiệu"
          aria-label="Tìm thương hiệu"
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-3 focus:ring-brand-500/15"
        />
      </div>

      <ul className="mt-3 space-y-1">
        {visible.map((brand) => (
          <li key={brand.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm text-slate-700 hover:text-slate-900">
              <input
                type="checkbox"
                checked={selected.includes(brand.slug)}
                onChange={() => toggle(brand.slug)}
                className="size-4 rounded accent-brand-600"
              />
              {brand.name}
            </label>
          </li>
        ))}
        {visible.length === 0 && <li className="px-1 py-1.5 text-sm text-slate-400">Không có thương hiệu phù hợp</li>}
      </ul>

      {!normalized && (hiddenCount > 0 || showAll) && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 px-1 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {showAll ? 'Thu gọn' : `Xem thêm (${hiddenCount})`}
        </button>
      )}
    </div>
  )
}
