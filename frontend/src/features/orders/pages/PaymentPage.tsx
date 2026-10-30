import { CircleCheck, CircleX, Clock, FlaskConical, Lock, ReceiptText, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getErrorMessage } from '@/api/errors'
import { orderPath, PATHS } from '@/app/paths'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { CopyButton } from '@/components/ui/CopyButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useNow } from '@/hooks/useNow'
import { formatDateTime, formatDuration, formatPrice } from '@/lib/format'
import { CancelOrderDialog } from '../components/CancelOrderDialog'
import { CheckoutSteps } from '../components/CheckoutSteps'
import { OrderItemsList } from '../components/OrderItemsList'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { OrderTotals } from '../components/OrderTotals'
import { OrderLoadState } from '../components/OrderLoadState'
import { useCancelOrder, useOrderDetail, usePayOrder } from '../queries'
import type { OrderDetail } from '../types'

export function PaymentPage() {
  const { id = '' } = useParams()
  const query = useOrderDetail(id)
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

  const paid = order.paidAt !== null && order.status !== 'CANCELLED'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <title>{`Thanh toán đơn ${order.code} · ShopFast`}</title>
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6">
        <CheckoutSteps current={3} done={paid} />
      </div>

      {order.status === 'PENDING_PAYMENT' ? (
        <PaymentCard order={order} />
      ) : paid ? (
        <PaidCard order={order} />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState
            icon={CircleX}
            title="Đơn hàng đã bị huỷ"
            description={`Đơn ${order.code} đã bị huỷ nên không thể thanh toán.`}
            action={
              <Link to={orderPath(order.id)} className={buttonClasses('outline')}>
                Xem chi tiết đơn
              </Link>
            }
          />
        </div>
      )}

      <OrderInfo order={order} />
    </div>
  )
}

function PaymentCard({ order }: { order: OrderDetail }) {
  const navigate = useNavigate()
  const now = useNow()
  const payOrder = usePayOrder()
  const cancelOrder = useCancelOrder()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const remaining = order.paymentDueAt ? new Date(order.paymentDueAt).getTime() - now : 0

  const pay = async () => {
    setPaying(true)
    setError(null)
    try {
      // Thành công: chi tiết đơn được tải lại => trang tự chuyển sang "Thanh toán thành công"
      await payOrder.mutateAsync(order.id)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setPaying(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5">
        <CircleCheck className="size-5 text-emerald-600" aria-hidden />
        <p className="font-semibold text-emerald-800">Đặt hàng thành công!</p>
        <p className="flex items-center gap-1 text-sm text-emerald-800">
          Mã đơn <strong>{order.code}</strong>
          <CopyButton value={order.code} label="Sao chép mã đơn" />
        </p>
        <OrderStatusBadge status={order.status} className="ml-auto" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-sm text-slate-500">Số tiền cần thanh toán</p>
        <p className="mt-1 text-4xl font-bold text-brand-600">{formatPrice(order.totalAmount)}</p>

        {order.canPay ? (
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Clock className="size-5 shrink-0 text-amber-600" aria-hidden />
            <p>
              Hạn thanh toán: <strong>{formatDateTime(order.paymentDueAt!)}</strong>
              <span className="mx-1.5 text-amber-400">·</span>
              <span className="font-semibold text-brand-700">còn {formatDuration(remaining)}</span>
            </p>
          </div>
        ) : (
          <Alert variant="error" className="mt-5">
            Đơn đã quá hạn thanh toán và sẽ được hệ thống tự huỷ. Bạn có thể đặt lại từ giỏ hàng.
          </Alert>
        )}

        {error && (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        )}

        {order.canPay && (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium tracking-wide text-slate-600 uppercase ring-1 ring-slate-200">
              <FlaskConical className="size-3.5" aria-hidden />
              Cổng thanh toán giả lập (môi trường thử nghiệm)
            </p>
            <Button size="lg" className="mt-4 w-full" onClick={pay} loading={paying} loadingText="Đang thanh toán...">
              <Lock className="size-4.5" aria-hidden />
              Thanh toán ngay
            </Button>
            <p className="mt-3 text-xs text-slate-500">Không trừ tiền thật. Đơn sẽ chuyển sang “Đã thanh toán”.</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <Link to={orderPath(order.id)} className={buttonClasses('outline')}>
            Thanh toán sau
          </Link>
          {order.canCancel && (
            <Button variant="ghostDanger" onClick={() => setCancelOpen(true)} disabled={paying}>
              <CircleX className="size-4.5" aria-hidden />
              Huỷ đơn
            </Button>
          )}
        </div>
      </section>

      <CancelOrderDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        mode="customer"
        code={order.code}
        totalAmount={order.totalAmount}
        paid={false}
        onConfirm={async (reason) => {
          await cancelOrder.mutateAsync({ orderId: order.id, reason })
          navigate(orderPath(order.id))
        }}
      />
    </>
  )
}

function PaidCard({ order }: { order: OrderDetail }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center sm:px-10">
      <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
        <CircleCheck className="size-10" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">Thanh toán thành công</h1>
      <p className="mx-auto mt-2 max-w-md text-slate-600">
        Đơn <strong className="text-slate-900">{order.code}</strong> đã được thanh toán{' '}
        <strong className="text-slate-900">{formatPrice(order.totalAmount)}</strong>. Kho sẽ xác nhận và đóng gói trong
        thời gian sớm nhất.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to={orderPath(order.id)} className={buttonClasses()}>
          <ReceiptText className="size-4.5" aria-hidden />
          Xem đơn hàng
        </Link>
        <Link to={PATHS.home} className={buttonClasses('outline')}>
          <ShoppingBag className="size-4.5" aria-hidden />
          Tiếp tục mua sắm
        </Link>
      </div>
    </section>
  )
}

function OrderInfo({ order }: { order: OrderDetail }) {
  const quantity = order.items.reduce((sum, i) => sum + i.quantity, 0)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Thông tin đơn hàng</h2>
      <dl className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
        <dt className="text-slate-500">Người nhận</dt>
        <dd className="font-medium text-slate-900">
          {order.recipientName} · {order.recipientPhone}
        </dd>
        <dt className="text-slate-500">Địa chỉ</dt>
        <dd className="text-slate-900">{order.shippingAddress}</dd>
        <dt className="text-slate-500">Đặt lúc</dt>
        <dd className="text-slate-900">{formatDateTime(order.createdAt)}</dd>
      </dl>
      <div className="mt-5">
        <OrderItemsList items={order.items} />
      </div>
      <OrderTotals
        className="mt-5 border-t border-slate-100 pt-5"
        subtotal={order.subtotal}
        shippingFee={order.shippingFee}
        totalAmount={order.totalAmount}
        quantity={quantity}
      />
    </section>
  )
}
