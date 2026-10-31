import { CircleSlash, PackageX, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { productPath } from '@/app/paths'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { ProductImage } from '@/features/catalog/components/ProductImage'
import { StockStatus } from '@/features/catalog/components/StockStatus'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import { MAX_QUANTITY_PER_ITEM } from '../constants'
import type { CartIssue, CartItem } from '../types'

const ISSUES: Record<CartIssue, { label: string; message: (stock: number) => string; icon: LucideIcon; tone: 'amber' | 'slate' }> = {
  INSUFFICIENT_STOCK: {
    label: 'Vượt quá tồn kho',
    message: (stock) => `Chỉ còn ${stock} sản phẩm trong kho. Vui lòng giảm số lượng.`,
    icon: TriangleAlert,
    tone: 'amber',
  },
  OUT_OF_STOCK: {
    label: 'Hết hàng',
    message: () => 'Sản phẩm tạm hết hàng. Vui lòng xoá khỏi giỏ để tiếp tục đặt hàng.',
    icon: PackageX,
    tone: 'slate',
  },
  INACTIVE: {
    label: 'Ngừng kinh doanh',
    message: () => 'Sản phẩm đã ngừng kinh doanh. Vui lòng xoá khỏi giỏ để tiếp tục đặt hàng.',
    icon: CircleSlash,
    tone: 'slate',
  },
}

const TONES = {
  amber: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', notice: 'border-amber-200 bg-amber-50 text-amber-800' },
  slate: { pill: 'bg-slate-100 text-slate-600 ring-slate-200', notice: 'border-slate-200 bg-slate-50 text-slate-700' },
}

type CartItemRowProps = {
  item: CartItem
  onQuantityChange: (quantity: number) => void
  onRemove: () => void
  /** Đang lưu thay đổi của dòng này: khoá thao tác */
  pending?: boolean
}

export function CartItemRow({ item, onQuantityChange, onRemove, pending = false }: CartItemRowProps) {
  const { product, quantity, lineTotal, issue } = item
  const issueInfo = issue ? ISSUES[issue] : null
  const tone = issueInfo ? TONES[issueInfo.tone] : null
  // Hết hàng/ngừng bán: chỉ còn cách xoá
  const unavailable = issue === 'OUT_OF_STOCK' || issue === 'INACTIVE'
  const maxQuantity = Math.max(1, Math.min(product.stock, MAX_QUANTITY_PER_ITEM))

  return (
    <li
      aria-busy={pending}
      className={cn(
        'relative p-4 transition-opacity sm:p-5',
        issue === 'INSUFFICIENT_STOCK' && 'bg-amber-50/40',
        pending && 'pointer-events-none opacity-60',
      )}
    >
      {issue === 'INSUFFICIENT_STOCK' && <span className="absolute inset-y-0 left-0 w-1 bg-amber-400" aria-hidden />}

      <div className="flex gap-4">
        <ProductImage
          categorySlug={product.category.slug}
          src={product.imageUrl}
          size="thumb"
          className={cn('size-18 shrink-0 sm:size-24', unavailable && 'opacity-60')}
        />

        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-6 gap-y-3 sm:flex-nowrap sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{product.brand.name}</p>
            {issue === 'INACTIVE' ? (
              <p className="mt-0.5 line-clamp-2 text-sm font-medium text-slate-500 sm:text-base">{product.name}</p>
            ) : (
              <Link
                to={productPath(product.slug)}
                className="mt-0.5 line-clamp-2 text-sm font-medium text-slate-900 hover:text-brand-700 sm:text-base"
              >
                {product.name}
              </Link>
            )}
            <p className="mt-1 text-xs text-slate-500">
              <span className="hidden sm:inline">
                SKU: {product.sku}
                <span className="mx-1.5 text-slate-300">·</span>
              </span>
              Đơn giá: <span className="font-medium text-slate-700">{formatPrice(product.price)}</span>
            </p>
            <div className="mt-1.5">
              {issueInfo && tone ? (
                <span
                  className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tone.pill)}
                >
                  {issueInfo.label}
                </span>
              ) : (
                <StockStatus stock={product.stock} />
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onRemove}
            aria-label={`Xoá ${product.name} khỏi giỏ`}
            title="Xoá khỏi giỏ"
            className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 sm:order-last sm:m-0"
          >
            <Trash2 className="size-4.5" aria-hidden />
          </button>

          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:gap-6">
            {issue === 'INACTIVE' ? (
              <span className="text-sm text-slate-500">Số lượng: {quantity}</span>
            ) : (
              <QuantityStepper
                value={quantity}
                max={maxQuantity}
                onChange={onQuantityChange}
                disabled={unavailable}
                label={`Số lượng ${product.name}`}
              />
            )}
            <div className="text-right sm:w-36">
              <p className={cn('font-bold', issue ? 'text-slate-400 line-through' : 'text-slate-900 sm:text-lg')}>
                {formatPrice(lineTotal)}
              </p>
              {issue && <p className="mt-0.5 text-xs text-slate-500">Không tính vào tạm tính</p>}
            </div>
          </div>
        </div>
      </div>

      {issueInfo && tone && (
        <div
          className={cn(
            'mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3.5 py-2.5 text-sm sm:ml-28',
            tone.notice,
          )}
        >
          <issueInfo.icon className="size-4.5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">{issueInfo.message(product.stock)}</p>
          {issue === 'INSUFFICIENT_STOCK' ? (
            <button
              type="button"
              onClick={() => onQuantityChange(maxQuantity)}
              className="font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              Cập nhật về {maxQuantity}
            </button>
          ) : (
            <button
              type="button"
              onClick={onRemove}
              className="font-semibold text-red-600 underline-offset-2 hover:underline"
            >
              Xoá khỏi giỏ
            </button>
          )}
        </div>
      )}
    </li>
  )
}
