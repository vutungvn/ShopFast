import { CircleCheck, Clock, CreditCard, PackageCheck, Truck, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { orderPath, orderPaymentPath } from '@/app/paths'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { CopyButton } from '@/components/ui/CopyButton'
import { ProductImage } from '@/features/catalog/components/ProductImage'
import { cn } from '@/lib/cn'
import { formatDateTime, formatDuration, formatPrice } from '@/lib/format'
import type { OrderSummary } from '../types'
import { OrderStatusBadge } from './OrderStatusBadge'

type Note = { icon: LucideIcon; tone: string; text: ReactNode }

/** Dòng nhắc theo trạng thái dưới danh sách sản phẩm */
function statusNote(order: OrderSummary, now: number): Note | null {
  switch (order.status) {
    case 'PENDING_PAYMENT':
      return order.canPay && order.paymentDueAt
        ? {
            icon: Clock,
            tone: 'border-amber-200 bg-amber-50 text-amber-800',
            text: (
              <>
                Vui lòng thanh toán trước <strong>{formatDateTime(order.paymentDueAt)}</strong> (còn{' '}
                {formatDuration(new Date(order.paymentDueAt).getTime() - now)}). Quá hạn đơn sẽ tự huỷ.
              </>
            ),
          }
        : {
            icon: TriangleAlert,
            tone: 'border-red-200 bg-red-50 text-red-700',
            text: 'Đã quá hạn thanh toán. Đơn sẽ sớm được hệ thống tự huỷ.',
          }
    case 'PAID':
      return { icon: CreditCard, tone: 'border-sky-200 bg-sky-50 text-sky-800', text: 'Đã thanh toán · Chờ ShopFast xác nhận đơn.' }
    case 'CONFIRMED':
    case 'PACKING':
      return { icon: PackageCheck, tone: 'border-violet-200 bg-violet-50 text-violet-800', text: 'Kho đang chuẩn bị hàng cho bạn.' }
    case 'SHIPPING':
      return { icon: Truck, tone: 'border-cyan-200 bg-cyan-50 text-cyan-800', text: 'Đơn đang trên đường giao tới bạn.' }
    case 'DELIVERED':
      return { icon: CircleCheck, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800', text: 'Đã giao hàng thành công.' }
    default:
      return null
  }
}

type OrderCardProps = {
  order: OrderSummary
  now: number
  onCancel: () => void
}

export function OrderCard({ order, now, onCancel }: OrderCardProps) {
  const note = statusNote(order, now)
  const more = order.itemCount - order.previewItems.length
  const cancelled = order.status === 'CANCELLED'

  return (
    <article className="rounded-2xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 px-5 py-4">
        <Link to={orderPath(order.id)} className="font-semibold text-slate-900 hover:text-brand-700">
          {order.code}
        </Link>
        <CopyButton value={order.code} label="Sao chép mã đơn" className="-ml-2" />
        <span className="text-sm text-slate-500">Đặt lúc {formatDateTime(order.createdAt)}</span>
        <OrderStatusBadge status={order.status} className="ml-auto" />
      </header>

      <div className="px-5 py-4">
        <ul className="space-y-3">
          {order.previewItems.map((item) => (
            <li key={item.productId} className={cn('flex items-center gap-4', cancelled && 'opacity-60')}>
              <ProductImage categorySlug="" src={item.productImageUrl} size="thumb" className="size-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{item.productName}</p>
                <p className="text-xs text-slate-500">
                  Số lượng: {item.quantity} · Đơn giá {formatPrice(item.unitPrice)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-slate-900">
                {formatPrice(item.unitPrice * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        {more > 0 && <p className="mt-3 text-xs text-slate-500">+ {more} sản phẩm khác</p>}

        {note && (
          <p className={cn('mt-4 flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm', note.tone)}>
            <note.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{note.text}</span>
          </p>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4">
        <span className="text-sm text-slate-500">{order.totalQuantity} sản phẩm</span>
        <p className="ml-auto text-sm text-slate-500">
          Tổng tiền:{' '}
          <span className={cn('text-lg font-bold', cancelled ? 'text-slate-500' : 'text-brand-600')}>
            {formatPrice(order.totalAmount)}
          </span>
        </p>
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          <Link to={orderPath(order.id)} className={buttonClasses('ghost', 'sm')}>
            Xem chi tiết
          </Link>
          {order.canCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Huỷ đơn
            </Button>
          )}
          {order.canPay && (
            <Link to={orderPaymentPath(order.id)} className={buttonClasses('primary', 'sm')}>
              <CreditCard className="size-4" aria-hidden />
              Thanh toán ngay
            </Link>
          )}
        </div>
      </footer>
    </article>
  )
}
