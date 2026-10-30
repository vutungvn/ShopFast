import axios from 'axios'
import { CircleX, Clock, Eye, Lock, Mail, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { getErrorMessage } from '@/api/errors'
import { PATHS } from '@/app/paths'
import { Alert } from '@/components/ui/Alert'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { Toast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/auth-context'
import type { User } from '@/features/auth/types'
import { CancelOrderDialog } from '@/features/orders/components/CancelOrderDialog'
import { PaymentCard, RecipientCard } from '@/features/orders/components/OrderInfoCards'
import { OrderItemsList } from '@/features/orders/components/OrderItemsList'
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge'
import { OrderStepper } from '@/features/orders/components/OrderStepper'
import { OrderTimeline } from '@/features/orders/components/OrderTimeline'
import { OrderLoadState } from '@/features/orders/components/OrderLoadState'
import { useAdvanceOrder, useCancelOrder, useOrderDetail } from '@/features/orders/queries'
import { ADVANCE_LABELS, nextStatus, STAFF_CANCELLABLE, STATUS_LABELS } from '@/features/orders/order-status'
import type { OrderDetail, OrderStatus } from '@/features/orders/types'
import { cn } from '@/lib/cn'
import { formatDateTime, formatPrice } from '@/lib/format'

const MAX_NOTE = 500
/** Mã thông báo: đổi `key` để hiện lại và đếm giờ tự đóng từ đầu */
let toastSeq = 0
/** Các bước kho cần đối chiếu hàng trước khi đẩy đi tiếp */
const PICKING: OrderStatus[] = ['PAID', 'CONFIRMED', 'PACKING']

export function StaffOrderDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  if (!user) return null
  return <StaffOrder user={user} orderId={id} />
}

function StaffOrder({ user, orderId }: { user: User; orderId: string }) {
  const query = useOrderDetail(orderId)
  const order = query.data

  if (!order) {
    return (
      <OrderLoadState
        isPending={query.isPending}
        error={query.error}
        refetch={() => query.refetch()}
        backTo={PATHS.staffOrders}
        backLabel="Về quản lý đơn"
      />
    )
  }

  return (
    <>
      <title>{`Đơn ${order.code} · Quản lý đơn`}</title>
      <Breadcrumb items={[{ label: 'Quản lý đơn', to: PATHS.staffOrders }, { label: order.code }]} />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Đơn {order.code}</h1>
        <CopyButton value={order.code} label="Sao chép mã đơn" />
        <OrderStatusBadge status={order.status} />
        <p className="flex items-center gap-1.5 text-sm text-slate-500 sm:ml-auto">
          <Clock className="size-4" aria-hidden />
          Đặt lúc {formatDateTime(order.createdAt)}
        </p>
      </div>

      <div className="mt-6">
        <OrderStepper status={order.status} timeline={order.timeline} viewer="staff" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-6">
          {/* key: đơn chuyển bước thì danh sách đối chiếu làm lại từ đầu */}
          {PICKING.includes(order.status) ? (
            <PickingList key={order.status} order={order} />
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="mb-4 border-b border-slate-100 pb-4 text-lg font-semibold text-slate-900">
                Sản phẩm trong đơn
              </h2>
              <OrderItemsList items={order.items} />
            </section>
          )}
          <OrderTimeline timeline={order.timeline} viewer="staff" title="Lịch sử xử lý" />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <ProcessCard user={user} order={order} />
          {order.customer && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="font-semibold text-slate-900">Khách đặt hàng</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center gap-2.5 font-medium text-slate-900">
                  <UserRound className="size-4 text-slate-400" aria-hidden />
                  {order.customer.fullName}
                </li>
                <li className="flex items-center gap-2.5 text-slate-700">
                  <Mail className="size-4 text-slate-400" aria-hidden />
                  {order.customer.email}
                </li>
              </ul>
            </section>
          )}
          <RecipientCard order={order} />
          <PaymentCard order={order} />
        </aside>
      </div>
    </>
  )
}

/** Danh sách đối chiếu hàng khi chuẩn bị đơn (chỉ hỗ trợ thao tác tại chỗ, không lưu lên hệ thống) */
function PickingList({ order }: { order: OrderDetail }) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allChecked = checked.size === order.items.length

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Sản phẩm cần chuẩn bị</h2>
          <p className="text-sm text-slate-500">Đánh dấu từng dòng khi đã lấy đủ hàng</p>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            allChecked ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
          )}
        >
          {checked.size}/{order.items.length} đã kiểm
        </span>
      </div>
      <ul className="mt-4 space-y-3">
        {order.items.map((item) => {
          const done = checked.has(item.productId)
          return (
            <li key={item.productId}>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-4 rounded-xl border p-3.5 transition-colors',
                  done ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(item.productId)}
                  className="size-5 shrink-0 accent-brand-600"
                />
                <span className="min-w-0 flex-1">
                  <span className={cn('block font-medium', done ? 'text-slate-500 line-through' : 'text-slate-900')}>
                    {item.productName}
                  </span>
                  <span className="text-xs text-slate-500">Đơn giá {formatPrice(item.unitPrice)}</span>
                </span>
                <span className="text-2xl font-bold text-slate-900 tabular-nums">× {item.quantity}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ProcessCard({ user, order }: { user: User; order: OrderDetail }) {
  const canProcess = user.role === 'WAREHOUSE' || user.role === 'ADMIN'
  const next = nextStatus(order.status)
  const canCancel = canProcess && STAFF_CANCELLABLE.includes(order.status)
  const advanceOrder = useAdvanceOrder()
  const cancelOrder = useCancelOrder()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)

  const advance = async () => {
    if (!next) return
    setBusy(true)
    setError(null)
    try {
      await advanceOrder.mutateAsync({ orderId: order.id, status: next, note: note.trim() })
      setNote('')
      setToast({ id: ++toastSeq, message: `${order.code} → ${STATUS_LABELS[next]}` })
    } catch (e) {
      const current = axios.isAxiosError(e) ? (e.response?.data?.currentStatus as OrderStatus | undefined) : undefined
      setError(
        current
          ? `Đơn vừa được người khác cập nhật sang “${STATUS_LABELS[current]}”. Màn hình đã hiện trạng thái mới.`
          : getErrorMessage(e),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Xử lý đơn</h2>

      {!canProcess ? (
        <p className="mt-3 flex gap-2.5 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
          Bạn chỉ có quyền xem đơn. Đổi trạng thái và huỷ đơn do nhân viên kho hoặc quản trị viên thực hiện.
        </p>
      ) : next ? (
        <>
          <p className="mt-1 text-sm text-slate-500">
            Bước tiếp theo: <strong className="text-slate-700">{STATUS_LABELS[next]}</strong>
          </p>
          {error && (
            <Alert variant="warning" className="mt-4">
              {error}
            </Alert>
          )}
          <Button
            size="lg"
            className="mt-4 w-full"
            onClick={advance}
            loading={busy}
            loadingText="Đang cập nhật..."
          >
            {ADVANCE_LABELS[next]}
          </Button>
          <TextAreaField
            className="mt-4"
            label="Ghi chú"
            hint="(không bắt buộc)"
            placeholder="Ghi chú lưu vào lịch sử xử lý, vd: đã gọi xác nhận với khách"
            maxLength={MAX_NOTE}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {order.status === 'PENDING_PAYMENT'
            ? 'Đơn đang chờ khách thanh toán, kho chưa cần xử lý.'
            : order.status === 'DELIVERED'
              ? 'Đơn đã giao thành công. Không còn bước xử lý nào.'
              : 'Đơn đã bị huỷ. Không còn bước xử lý nào.'}
        </p>
      )}

      {canProcess && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          {canCancel ? (
            <Button variant="ghostDanger" className="w-full" onClick={() => setCancelOpen(true)} disabled={busy}>
              <CircleX className="size-4.5" aria-hidden />
              Huỷ đơn này
            </Button>
          ) : (
            order.status === 'SHIPPING' && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Lock className="size-4" aria-hidden />
                Đơn đang giao không thể huỷ.
              </p>
            )
          )}
        </div>
      )}

      <CancelOrderDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        mode="staff"
        code={order.code}
        totalAmount={order.totalAmount}
        paid={order.paidAt !== null}
        onConfirm={async (reason) => {
          await cancelOrder.mutateAsync({ orderId: order.id, reason })
        }}
      />

      {toast && (
        <Toast key={toast.id} variant="success" title="Đã cập nhật đơn" onClose={() => setToast(null)}>
          {toast.message}
        </Toast>
      )}
    </section>
  )
}
