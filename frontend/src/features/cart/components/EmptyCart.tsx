import { ArrowRight, ShoppingCart } from 'lucide-react'
import { Link } from 'react-router'
import { PATHS } from '@/app/paths'
import { buttonClasses } from '@/components/ui/button-styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProductCard, ProductCardSkeleton } from '@/features/catalog/components/ProductCard'
import { useCategoryTree, useProducts } from '@/features/catalog/queries'

export function EmptyCart() {
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white">
        <EmptyState
          icon={ShoppingCart}
          title="Giỏ hàng đang trống"
          description="Hãy khám phá sản phẩm và thêm món bạn thích vào giỏ nhé."
          action={
            <div className="flex flex-col items-center gap-8">
              <Link to={PATHS.home} className={buttonClasses()}>
                Khám phá sản phẩm
                <ArrowRight className="size-4.5" aria-hidden />
              </Link>
              <CategoryShortcuts />
            </div>
          }
        />
      </div>
      <Recommendations />
    </>
  )
}

function CategoryShortcuts() {
  const categories = useCategoryTree()
  if (!categories.data?.length) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-6">
      <span className="text-xs text-slate-500">Gợi ý:</span>
      {categories.data.map((node) => (
        <Link
          key={node.id}
          to={`${PATHS.home}?category=${node.slug}`}
          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
        >
          {node.name}
        </Link>
      ))}
    </div>
  )
}

function Recommendations() {
  const products = useProducts({ inStock: true, limit: 4 })
  const items = products.data?.items ?? []

  if (products.isError || (!products.isPending && items.length === 0)) return null

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Có thể bạn sẽ thích</h2>
        <Link to={PATHS.home} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          Xem tất cả
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {products.isPending
          ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)
          : items.map((item) => <ProductCard key={item.id} product={item} />)}
      </div>
    </section>
  )
}
