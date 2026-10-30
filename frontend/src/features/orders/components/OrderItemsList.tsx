import { Package } from 'lucide-react'
import { Link } from 'react-router'
import { productPath } from '@/app/paths'
import { formatPrice } from '@/lib/format'
import type { OrderItem } from '../types'

type OrderItemsListProps = {
  items: Array<OrderItem & { productSlug?: string }>
}

/** Các dòng sản phẩm của đơn: tên và đơn giá là của lúc đặt (sản phẩm có thể đã đổi giá / ngừng bán) */
export function OrderItemsList({ items }: OrderItemsListProps) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.productId} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
          {/* Dòng đơn không lưu danh mục nên dùng icon chung thay cho ảnh */}
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100">
            <Package className="size-7 text-slate-300" strokeWidth={1.25} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            {item.productSlug ? (
              <Link
                to={productPath(item.productSlug)}
                className="line-clamp-2 font-medium text-slate-900 hover:text-brand-700"
              >
                {item.productName}
              </Link>
            ) : (
              <p className="line-clamp-2 font-medium text-slate-900">{item.productName}</p>
            )}
            <p className="mt-0.5 text-sm text-slate-500">
              Đơn giá {formatPrice(item.unitPrice)} × {item.quantity}
            </p>
          </div>
          <span className="shrink-0 font-semibold text-slate-900">{formatPrice(item.lineTotal)}</span>
        </li>
      ))}
    </ul>
  )
}
