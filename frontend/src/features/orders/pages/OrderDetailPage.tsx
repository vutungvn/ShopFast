import { Bot, Clock, CreditCard, Info } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { orderPaymentPath, PATHS } from '@/app/paths'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { CopyButton } from '@/components/ui/CopyButton'
import { formatDateTime } from '@/lib/format'
import { CancelOrderDialog } from '../components/CancelOrderDialog'
import { PaymentCard, RecipientCard } from '../components/OrderInfoCards'
import { OrderItemsList } from '../components/OrderItemsList'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { OrderStepper } from '../components/OrderStepper'
import { OrderTimeline } from '../components/OrderTimeline'
import { OrderLoadState } from '../components/OrderLoadState'
import { useCancelOrder, useOrderDetail } from '../queries'

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const query = useOrderDetail(id)
  const cancelOrder = useCancelOrder()
  const [cancelOpen, setCancelOpen] = useState(false)
  const order = query.data

  if (!order) {
    return (
      <OrderLoadState
        isPending={query.isPending}
        error={query.error}
        refetch={() => query.refetch()}
        backTo={PATHS.orders}
        backLabel="Xem đơn mua"
      />
    )
  }

  const processing = ['CONFIRMED', 'PACKING', 'SHIPPING'].includes(order.status)

  return (
    <>
      <title>{`Đơn hàng ${order.code} · ShopFast`}</title>
      <Breadcrumb
        items={[
          { label: 'Trang chủ', to: PATHS.home },
          { label: 'Đơn mua', to: PATHS.orders },
          { label: order.code },
        ]}
      />

      <section className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Đơn hàng {order.code}</h1>
            <CopyButton value={order.code} label="Sao chép mã đơn" />
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <Clock className="size-4" aria-hidden />
            Đặt lúc {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {order.canCancel && (
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              Huỷ đơn
            </Button>
          )}
          {order.canPay && (
            <Link to={orderPaymentPath(order.id)} className={buttonClasses()}>
              <CreditCard className="size-4.5" aria-hidden />
              Thanh toán ngay
            </Link>
          )}
        </div>
      </section>

      <div className="mt-6">
        <OrderStepper status={order.status} timeline={order.timeline} viewer="customer" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-end justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Sản phẩm</h2>
                <p className="text-sm text-slate-500">Giá tại thời điểm đặt hàng</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {order.items.length} loại
              </span>
            </div>
            <OrderItemsList items={order.items} />
          </section>
          <OrderTimeline timeline={order.timeline} viewer="customer" />
        </div>

        <aside className="space-y-6">
          <RecipientCard order={order} />
          <PaymentCard order={order} />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="font-semibold text-slate-900">Cần hỗ trợ đơn hàng?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Hỏi trợ lý AI về trạng thái đơn hoặc gửi yêu cầu cho bộ phận chăm sóc khách hàng.
            </p>
            <Button variant="outline" className="mt-4 w-full" disabled title="Trợ lý AI sắp ra mắt">
              <Bot className="size-4.5" aria-hidden />
              Chat với trợ lý AI (sắp ra mắt)
            </Button>
          </section>

          {processing && (
            <p className="flex gap-2.5 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              Đơn đã được kho xử lý nên không thể huỷ trên website.
            </p>
          )}
        </aside>
      </div>

      <CancelOrderDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        mode="customer"
        code={order.code}
        totalAmount={order.totalAmount}
        paid={order.paidAt !== null}
        onConfirm={async (reason) => {
          await cancelOrder.mutateAsync({ orderId: order.id, reason })
        }}
      />
    </>
  )
}
