import { X } from 'lucide-react'
import { formatPrice } from '@/lib/format'
import type { CatalogFilters } from '../hooks/useCatalogFilters'
import { useBrands } from '../queries'

type ActiveFilterChipsProps = {
  filters: CatalogFilters
  onChange: (patch: Partial<CatalogFilters>) => void
}

function priceLabel(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `${formatPrice(min)} – ${formatPrice(max)}`
  if (min !== undefined) return `Từ ${formatPrice(min)}`
  return `Đến ${formatPrice(max!)}`
}

export function ActiveFilterChips({ filters, onChange }: ActiveFilterChipsProps) {
  const brands = useBrands()
  const brandName = (slug: string) => brands.data?.find((b) => b.slug === slug)?.name ?? slug

  const chips = [
    ...filters.brands.map((slug) => ({
      key: `brand-${slug}`,
      label: brandName(slug),
      remove: () => onChange({ brands: filters.brands.filter((s) => s !== slug) }),
    })),
    ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
      ? [
          {
            key: 'price',
            label: priceLabel(filters.minPrice, filters.maxPrice),
            remove: () => onChange({ minPrice: undefined, maxPrice: undefined }),
          },
        ]
      : []),
    ...(filters.inStock
      ? [{ key: 'stock', label: 'Còn hàng', remove: () => onChange({ inStock: false }) }]
      : []),
  ]

  if (chips.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Bộ lọc đang áp dụng">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={chip.remove}
            aria-label={`Bỏ lọc ${chip.label}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pr-2 pl-3 text-xs font-medium text-brand-700 ring-1 ring-brand-100 transition-colors ring-inset hover:bg-brand-100"
          >
            {chip.label}
            <X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}
