import { Link } from 'react-router'
import { productPath } from '@/app/paths'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import type { Product } from '../types'
import { ProductImage } from './ProductImage'
import { StockStatus } from './StockStatus'

export function ProductCard({ product }: { product: Product }) {
  const outOfStock = product.stock <= 0
  return (
    <Link
      to={productPath(product.slug)}
      className={cn(
        'group flex flex-col rounded-2xl border border-slate-200 bg-white p-3 transition',
        'hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-lg hover:shadow-slate-200/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
      )}
    >
      <ProductImage categorySlug={product.category.slug} className={cn(outOfStock && 'opacity-60')} />
      <div className="flex flex-1 flex-col px-1 pt-3 pb-1">
        <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          {product.brand.name}
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 font-medium text-slate-900 group-hover:text-brand-700">
          {product.name}
        </h3>
        <p className="mt-1 text-xs text-slate-400">SKU: {product.sku}</p>
        <div className="mt-auto pt-3">
          <p className={cn('text-lg font-bold', outOfStock ? 'text-slate-400' : 'text-slate-900')}>
            {formatPrice(product.price)}
          </p>
          <div className="mt-1">
            <StockStatus stock={product.stock} />
          </div>
        </div>
      </div>
    </Link>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-3" aria-hidden>
      <div className="aspect-square rounded-xl bg-slate-100" />
      <div className="space-y-2 px-1 pt-3 pb-1">
        <div className="h-3 w-16 rounded bg-slate-200" />
        <div className="h-4 w-full rounded bg-slate-200" />
        <div className="h-4 w-2/3 rounded bg-slate-200" />
        <div className="h-5 w-28 rounded bg-slate-200 pt-3" />
      </div>
    </div>
  )
}
