import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import { PRODUCT_SORTS, SORT_LABELS, type ProductSort } from '../types'

type SortSelectProps = {
  value: ProductSort
  onChange: (sort: ProductSort) => void
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="hidden text-sm whitespace-nowrap text-slate-500 sm:block">
        Sắp xếp:
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as ProductSort)}
          className="h-10 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-sm font-medium text-slate-800 outline-none hover:border-slate-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
        >
          {PRODUCT_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      </div>
    </div>
  )
}
