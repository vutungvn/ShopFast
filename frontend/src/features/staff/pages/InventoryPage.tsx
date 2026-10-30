import { Ban, Boxes, CircleCheck, Info, PackageX, PencilLine, Search, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'
import { getErrorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { ProductImage } from '@/features/catalog/components/ProductImage'
import { LOW_STOCK_THRESHOLD } from '@/features/catalog/components/StockStatus'
import { useBrands, useCategoryTree } from '@/features/catalog/queries'
import type { CategoryNode, Product } from '@/features/catalog/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import type { ManageProductQuery } from '../api'
import { InventoryDialog } from '../components/InventoryDialog'
import { StatTile } from '../components/StatTile'
import { useInventoryStats, useManageProducts } from '../queries'

const PAGE_SIZE = 10
type StockFilter = 'all' | 'in' | 'low' | 'out'

const STOCK_FILTERS: Array<[StockFilter, string]> = [
  ['all', 'Tất cả'],
  ['in', 'Còn hàng'],
  ['low', 'Sắp hết'],
  ['out', 'Hết hàng'],
]

function stockTone(stock: number) {
  if (stock <= 0) return { dot: 'bg-red-500', label: 'Hết hàng', text: 'text-red-600' }
  if (stock <= LOW_STOCK_THRESHOLD) return { dot: 'bg-amber-500', label: 'Sắp hết', text: 'text-amber-700' }
  return { dot: 'bg-emerald-500', label: null, text: 'text-slate-900' }
}

/** Cây danh mục thành danh sách phẳng có thụt lề cho ô chọn (lọc danh mục cha gồm cả danh mục con) */
function flattenCategories(nodes: CategoryNode[], depth = 0): Array<{ slug: string; label: string }> {
  return nodes.flatMap((node) => [
    { slug: node.slug, label: `${'— '.repeat(depth)}${node.name}` },
    ...flattenCategories(node.children, depth + 1),
  ])
}

export function InventoryPage() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [stock, setStock] = useState<StockFilter>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Product | null>(null)
  // Dòng vừa cập nhật: tô sáng kèm "a → b" vài giây
  const [flash, setFlash] = useState<{ id: string; before: number; after: number } | null>(null)

  const keyword = useDebouncedValue(q.trim())
  const query: ManageProductQuery = {
    q: keyword || undefined,
    category: category || undefined,
    brand: brand || undefined,
    inStock: stock === 'in' ? true : stock === 'out' ? false : undefined,
    lowStock: stock === 'low' || undefined,
    // Mặc định chỉ sản phẩm đang bán; tick "hiện ngừng bán" thì lấy tất cả
    isActive: showInactive ? undefined : true,
    sort: 'name_asc',
    page,
    limit: PAGE_SIZE,
  }
  const products = useManageProducts(query)
  const stats = useInventoryStats()
  const categories = useCategoryTree()
  const brands = useBrands()

  const filtering = Boolean(q.trim() || category || brand || stock !== 'all' || showInactive)
  // Đổi bộ lọc thì về trang 1
  const filter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value)
      setPage(1)
    }
  const clear = () => {
    setQ('')
    setCategory('')
    setBrand('')
    setStock('all')
    setShowInactive(false)
    setPage(1)
  }

  const selectClass =
    'h-10 max-w-52 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500'
  const meta = products.data?.meta

  return (
    <>
      <title>Tồn kho · ShopFast</title>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Tồn kho</h1>
      <p className="mt-1 text-sm text-slate-500">Cập nhật số lượng tồn thực tế của từng sản phẩm</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Tổng sản phẩm" value={stats.data?.total ?? 0} hint="Gồm cả sản phẩm ngừng bán" icon={Boxes} tone="slate" />
        <StatTile
          label={`Sắp hết (≤ ${LOW_STOCK_THRESHOLD})`}
          value={stats.data?.lowStock ?? 0}
          hint="Cần lên kế hoạch nhập"
          icon={TriangleAlert}
          tone="amber"
          onClick={() => filter(setStock)('low')}
          active={stock === 'low'}
        />
        <StatTile
          label="Hết hàng"
          value={stats.data?.outOfStock ?? 0}
          hint="Khách không đặt được"
          icon={PackageX}
          tone="red"
          onClick={() => filter(setStock)('out')}
          active={stock === 'out'}
        />
        <StatTile label="Ngừng bán" value={stats.data?.inactive ?? 0} hint="Ẩn khỏi cửa hàng" icon={Ban} tone="slate" />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => filter(setQ)(e.target.value)}
              placeholder="Tìm theo tên hoặc đúng mã SKU"
              aria-label="Tìm theo tên hoặc mã SKU"
              maxLength={100}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
            />
          </div>
          <select value={category} onChange={(e) => filter(setCategory)(e.target.value)} aria-label="Danh mục" className={selectClass}>
            <option value="">Tất cả danh mục</option>
            {flattenCategories(categories.data ?? []).map(({ slug, label }) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
          <select value={brand} onChange={(e) => filter(setBrand)(e.target.value)} aria-label="Thương hiệu" className={selectClass}>
            <option value="">Tất cả thương hiệu</option>
            {(brands.data ?? []).map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
          <div role="group" aria-label="Lọc theo tồn kho" className="flex rounded-lg bg-slate-100 p-1">
            {STOCK_FILTERS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={stock === key}
                onClick={() => filter(setStock)(key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  stock === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => filter(setShowInactive)(e.target.checked)}
              className="size-4 accent-brand-600"
            />
            Hiện sản phẩm ngừng bán
          </label>
          {filtering && (
            <Button variant="ghost" size="sm" onClick={clear}>
              <X className="size-4" aria-hidden />
              Xoá lọc
            </Button>
          )}
        </div>

        {products.isPending ? (
          <div className="space-y-2 border-t border-slate-100 p-4" aria-label="Đang tải">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : products.isError ? (
          <div className="border-t border-slate-100 p-6">
            <Alert variant="error">Không tải được danh sách sản phẩm. {getErrorMessage(products.error)}</Alert>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => products.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : products.data.items.length === 0 ? (
          <div className="border-t border-slate-100">
            <EmptyState icon={Boxes} title="Không có sản phẩm phù hợp" description="Thử bỏ bớt bộ lọc hoặc tìm với từ khoá khác." />
          </div>
        ) : (
          <div
            className={cn('overflow-x-auto border-t border-slate-100 transition-opacity', products.isPlaceholderData && 'opacity-60')}
            aria-busy={products.isFetching}
          >
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3">Danh mục</th>
                  <th className="px-4 py-3">Thương hiệu</th>
                  <th className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1" title="Giá do quản trị viên cập nhật">
                      Giá bán
                      <Info className="size-3.5" aria-hidden />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">Tồn kho</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.data.items.map((p) => {
                  const tone = stockTone(p.stock)
                  const flashed = flash?.id === p.id
                  return (
                    <tr key={p.id} className={cn('transition-colors', flashed && 'bg-emerald-50/70')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProductImage
                            categorySlug={p.category.slug}
                            size="thumb"
                            className={cn('size-11 shrink-0 [&>svg]:size-6', !p.isActive && 'opacity-50')}
                          />
                          <div className="min-w-0">
                            <p className={cn('flex flex-wrap items-center gap-2 font-medium', p.isActive ? 'text-slate-900' : 'text-slate-500')}>
                              {p.name}
                              {flashed && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                  <CircleCheck className="size-3.5" aria-hidden />
                                  Đã cập nhật: {flash.before} → {flash.after}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">SKU: {p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.category.name}</td>
                      <td className="px-4 py-3 text-slate-600">{p.brand.name}</td>
                      <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{formatPrice(p.price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('inline-flex items-center gap-2 text-lg font-bold tabular-nums', tone.text)}>
                          <span className={cn('size-2 rounded-full', tone.dot)} aria-hidden />
                          {p.stock}
                        </span>
                        {tone.label && <p className={cn('text-xs font-medium', tone.text)}>{tone.label}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                            p.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200',
                          )}
                        >
                          {p.isActive ? 'Đang bán' : 'Ngừng bán'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                          <PencilLine className="size-4" aria-hidden />
                          Cập nhật kho
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row">
            <p className="text-sm text-slate-500">
              Hiển thị {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} trong {meta.total} sản phẩm
            </p>
            <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
          </div>
        )}
      </section>

      <InventoryDialog
        product={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated, before) => {
          setFlash({ id: updated.id, before, after: updated.stock })
          setTimeout(() => setFlash((f) => (f?.id === updated.id ? null : f)), 5000)
        }}
      />
    </>
  )
}
