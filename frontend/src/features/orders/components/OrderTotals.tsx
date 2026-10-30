import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'

type OrderTotalsProps = {
  subtotal: number
  shippingFee: number
  totalAmount: number
  /** Tổng số món, hiện ở dòng tạm tính */
  quantity: number
  className?: string
}

/** Tạm tính / phí vận chuyển / tổng cộng: dùng ở checkout, thanh toán, chi tiết đơn */
export function OrderTotals({ subtotal, shippingFee, totalAmount, quantity, className }: OrderTotalsProps) {
  return (
    <dl className={cn('space-y-3 text-sm', className)}>
      <div className="flex justify-between gap-4">
        <dt className="text-slate-600">Tạm tính ({quantity} sản phẩm)</dt>
        <dd className="font-medium text-slate-900">{formatPrice(subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-slate-600">Phí vận chuyển</dt>
        <dd className={shippingFee === 0 ? 'font-medium text-emerald-700' : 'font-medium text-slate-900'}>
          {shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}
        </dd>
      </div>
      <div className="flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
        <dt className="font-semibold text-slate-900">Tổng cộng</dt>
        <dd className="text-2xl font-bold text-brand-600">{formatPrice(totalAmount)}</dd>
      </div>
    </dl>
  )
}
