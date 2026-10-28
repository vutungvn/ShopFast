import type { ReactNode } from 'react'
import { Switch } from '@/components/ui/Switch'
import type { CatalogFilters } from '../hooks/useCatalogFilters'
import { useBrands, useCategoryTree } from '../queries'
import { BrandFilter } from './BrandFilter'
import { CategoryFilter } from './CategoryFilter'
import { PriceFilter } from './PriceFilter'

type FilterPanelProps = {
  filters: CatalogFilters
  onChange: (patch: Partial<CatalogFilters>) => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-100 py-5 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  )
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="animate-pulse space-y-2.5" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 rounded bg-slate-100" style={{ width: `${60 + ((i * 17) % 35)}%` }} />
      ))}
    </div>
  )
}

/** Các nhóm lọc; dùng chung cho sidebar (desktop) và bottom sheet (mobile). */
export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const categories = useCategoryTree()
  const brands = useBrands()

  return (
    <div>
      <Section title="Danh mục">
        {categories.data ? (
          <CategoryFilter
            tree={categories.data}
            selected={filters.category}
            onSelect={(category) => onChange({ category })}
          />
        ) : (
          <ListSkeleton rows={5} />
        )}
      </Section>

      <Section title="Thương hiệu">
        {brands.data ? (
          <BrandFilter
            brands={brands.data}
            selected={filters.brands}
            onChange={(slugs) => onChange({ brands: slugs })}
          />
        ) : (
          <ListSkeleton rows={6} />
        )}
      </Section>

      <Section title="Khoảng giá (₫)">
        <PriceFilter
          key={`${filters.minPrice}-${filters.maxPrice}`}
          min={filters.minPrice}
          max={filters.maxPrice}
          onApply={onChange}
        />
      </Section>

      <Section title="Tình trạng">
        <Switch
          label="Chỉ hiện sản phẩm còn hàng"
          checked={filters.inStock}
          onChange={(inStock) => onChange({ inStock })}
        />
      </Section>
    </div>
  )
}
