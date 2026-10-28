import { PackageSearch, SlidersHorizontal } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { getErrorMessage } from '@/api/errors'
import { PATHS } from '@/app/paths'
import { Alert } from '@/components/ui/Alert'
import { Breadcrumb, type Crumb } from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { cn } from '@/lib/cn'
import { findCategoryPath } from '../category-tree'
import { ActiveFilterChips } from '../components/ActiveFilterChips'
import { FilterPanel } from '../components/FilterPanel'
import { MobileFilterSheet } from '../components/MobileFilterSheet'
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard'
import { SortSelect } from '../components/SortSelect'
import { PAGE_SIZE, useCatalogFilters } from '../hooks/useCatalogFilters'
import { useCategoryTree, useProducts } from '../queries'

export function CatalogPage() {
  const { filters, query, update, clearFilters, activeCount } = useCatalogFilters()
  const products = useProducts(query)
  const categories = useCategoryTree()
  const [sheetOpen, setSheetOpen] = useState(false)

  const categoryPath = categories.data
    ? findCategoryPath(categories.data, (n) => n.slug === filters.category)
    : []

  const title = filters.q
    ? `Kết quả cho “${filters.q}”`
    : filters.category
      ? (categoryPath.at(-1)?.name ?? 'Sản phẩm')
      : 'Tất cả sản phẩm'

  const crumbs: Crumb[] = [
    { label: 'Trang chủ', to: PATHS.home },
    ...(filters.q ? [{ label: 'Tìm kiếm' }] : []),
    ...categoryPath.map((node) => ({ label: node.name, to: `${PATHS.home}?category=${node.slug}` })),
  ]

  const meta = products.data?.meta
  const changePage = (page: number) => {
    update({ page })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <title>{`${title} · ShopFast`}</title>

      <div className="flex flex-col gap-2">
        <Breadcrumb items={crumbs} />
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {meta && <p className="text-sm text-slate-500">{meta.total} sản phẩm</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar bộ lọc (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Bộ lọc</h2>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Xoá tất cả
                </button>
              )}
            </div>
            <FilterPanel filters={filters} onChange={update} />
          </div>
        </aside>

        <section aria-label="Danh sách sản phẩm" className="min-w-0">
          {/* Thanh công cụ */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              Bộ lọc
              {activeCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
                  {activeCount}
                </span>
              )}
            </button>
            <div className="hidden min-w-0 flex-1 lg:block">
              <ActiveFilterChips filters={filters} onChange={update} />
            </div>
            <SortSelect value={filters.sort} onChange={(sort) => update({ sort })} />
          </div>

          <div className="mt-3 lg:hidden">
            <ActiveFilterChips filters={filters} onChange={update} />
          </div>

          <div className="mt-5">
            {products.isPending ? (
              <ProductGrid>
                {Array.from({ length: 8 }, (_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </ProductGrid>
            ) : products.isError ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <Alert variant="error">
                  Không tải được danh sách sản phẩm. {getErrorMessage(products.error)}
                </Alert>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => products.refetch()}>
                  Thử lại
                </Button>
              </div>
            ) : products.data.items.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white">
                <EmptyState
                  icon={PackageSearch}
                  title="Không tìm thấy sản phẩm phù hợp"
                  description="Hãy thử bỏ bớt bộ lọc hoặc tìm với từ khoá khác."
                  action={
                    activeCount > 0 && (
                      <Button variant="outline" onClick={clearFilters}>
                        Xoá bộ lọc
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              // Đang tải trang/bộ lọc mới: làm mờ kết quả cũ thay vì nháy về skeleton
              <div
                className={cn('transition-opacity', products.isPlaceholderData && 'opacity-60')}
                aria-busy={products.isFetching}
              >
                <ProductGrid>
                  {products.data.items.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </ProductGrid>
              </div>
            )}
          </div>

          {meta && meta.total > 0 && (
            <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row">
              <p className="text-sm text-slate-500">
                Hiển thị {(meta.page - 1) * PAGE_SIZE + 1}–{Math.min(meta.page * PAGE_SIZE, meta.total)} trong{' '}
                {meta.total} sản phẩm
              </p>
              <Pagination page={meta.page} totalPages={meta.totalPages} onChange={changePage} />
            </div>
          )}
        </section>
      </div>

      <MobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onClear={clearFilters}
        total={meta?.total}
      >
        <FilterPanel filters={filters} onChange={update} />
      </MobileFilterSheet>
    </>
  )
}

function ProductGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">{children}</div>
}
