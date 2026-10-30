import { CircleCheck, Clock, MapPin, Phone, UserRound } from 'lucide-react'
import { CopyButton } from '@/components/ui/CopyButton'
import { formatDateTime } from '@/lib/format'
import type { OrderDetail } from '../types'
import { OrderTotals } from './OrderTotals'

/** Thẻ người nhận và thẻ thanh toán ở cột phải trang chi tiết đơn (khách và kho) */
export function RecipientCard({ order }: { order: OrderDetail }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
        <MapPin className="size-5 text-brand-600" aria-hidden />
        Thông tin nhận hàng
      </h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        <li className="flex items-center gap-2.5 font-medium text-slate-900">
          <UserRound className="size-4 shrink-0 text-slate-400" aria-hidden />
          {order.recipientName}
        </li>
        <li className="flex items-center gap-2.5 text-slate-700">
          <Phone className="size-4 shrink-0 text-slate-400" aria-hidden />
          {order.recipientPhone}
          <CopyButton value={order.recipientPhone} label="Sao chép số điện thoại" className="-my-1" />
        </li>
        <li className="flex gap-2.5 text-slate-700">
          <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
          {order.shippingAddress}
        </li>
      </ul>
    </section>
  )
}

export function PaymentCard({ order }: { order: OrderDetail }) {
  const quantity = order.items.reduce((sum, i) => sum + i.quantity, 0)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="font-semibold text-slate-900">Chi tiết thanh toán</h2>
      <OrderTotals
        className="mt-4"
        subtotal={order.subtotal}
        shippingFee={order.shippingFee}
        totalAmount={order.totalAmount}
        quantity={quantity}
      />
      {order.paidAt ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Đã thanh toán lúc {formatDateTime(order.paidAt)} (cổng giả lập)
        </p>
      ) : order.status === 'PENDING_PAYMENT' ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {order.canPay
            ? `Chưa thanh toán · hạn ${formatDateTime(order.paymentDueAt!)}`
            : 'Đã quá hạn thanh toán'}
        </p>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-600">Chưa thanh toán</p>
      )}
    </section>
  )
}
