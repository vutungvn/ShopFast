import axios from 'axios'
import { CircleCheck, Clock, Eye, PackageOpen, Search, ShieldCheck, Truck, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getErrorMessage } from '@/api/errors'
import { staffOrderPath } from '@/app/paths'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Toast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/auth-context'
import type { User } from '@/features/auth/types'
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge'
import { useAdvanceOrder, useOrderStats, useStaffOrders } from '@/features/orders/queries'
import { ADVANCE_LABELS, STATUS_LABELS } from '@/features/orders/order-status'
import { ORDER_STATUSES, type OrderStatus, type StaffOrderSort, type StaffOrderSummary } from '@/features/orders/types'
import { cn } from '@/lib/cn'
import { formatDateTime, formatPrice } from '@/lib/format'
import { StatTile } from '../components/StatTile'

const PAGE_SIZE = 10

/** Tab trạng thái: mặc định "Cần xác nhận" (đã thanh toán, chờ kho) */
const TABS: Array<{ key: OrderStatus | 'all'; label: string }> = [
  { key: 'PAID', label: 'Cần xác nhận' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'PACKING', label: 'Đang đóng gói' },
  { key: 'SHIPPING', label: 'Đang giao' },
  { key: 'DELIVERED', label: 'Đã giao' },
  { key: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
  { key: 'CANCELLED', label: 'Đã huỷ' },
  { key: 'all', label: 'Tất cả' },
]

/** Mã thông báo: đổi `key` để hiện lại và đếm giờ tự đóng từ đầu */
let noticeSeq = 0

type Notice = { id: number; variant: 'success' | 'warning' | 'error'; title: string; message: string }

export function StaffOrdersPage() {
  const { user } = useAuth()
  return (
    <>
      <title>Quản lý đơn hàng · ShopFast</title>
      {user && <StaffOrders user={user} />}
    </>
  )
}

function StaffOrders({ user }: { user: User }) {
  const canProcess = user.role === 'WAREHOUSE' || user.role === 'ADMIN'
  // Bộ lọc trên URL: F5 / gửi link cho đồng nghiệp vẫn đúng
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const tab = statusParam === 'all' || ORDER_STATUSES.includes(statusParam as OrderStatus) ? statusParam! : 'PAID'
  const filters = {
    q: params.get('q') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    // Hàng đợi xử lý: đơn đặt trước làm trước
    sort: (params.get('sort') === 'newest' ? 'newest' : 'oldest') as StaffOrderSort,
    page: Math.max(1, Number(params.get('page')) || 1),
  }
  const orders = useStaffOrders({
    status: tab === 'all' ? undefined : [tab as OrderStatus],
    q: filters.q || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    sort: filters.sort,
    page: filters.page,
    limit: PAGE_SIZE,
  })
  const stats = useOrderStats()
  const counts = stats.data
  const advanceOrder = useAdvanceOrder()
  const [searchDraft, setSearchDraft] = useState(filters.q)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const update = (patch: Partial<Record<'status' | 'q' | 'from' | 'to' | 'sort' | 'page', string>>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    // Đổi bộ lọc thì về trang 1
    if (!('page' in patch)) next.delete('page')
    setParams(next)
  }
  const clearFilters = () => {
    setSearchDraft('')
    setParams(tab === 'PAID' ? {} : { status: tab })
  }
  const hasFilters = Boolean(filters.q || filters.from || filters.to || params.get('sort'))

  const advance = async (order: StaffOrderSummary) => {
    if (!order.nextStatus) return
    setPendingId(order.id)
    try {
      await advanceOrder.mutateAsync({ orderId: order.id, status: order.nextStatus, note: '' })
      setNotice({
        id: ++noticeSeq,
        variant: 'success',
        title: 'Đã cập nhật đơn',
        message: `${order.code} → ${STATUS_LABELS[order.nextStatus]}`,
      })
    } catch (e) {
      // 409 kèm trạng thái hiện tại: người khác vừa xử lý đơn này (danh sách đã tự cập nhật)
      const current = axios.isAxiosError(e) ? (e.response?.data?.currentStatus as OrderStatus | undefined) : undefined
      setNotice(
        current
          ? {
              id: ++noticeSeq,
              variant: 'warning',
              title: 'Đơn vừa được người khác cập nhật',
              message: `${order.code} hiện ở trạng thái “${STATUS_LABELS[current]}”.`,
            }
          : { id: ++noticeSeq, variant: 'error', title: 'Không cập nhật được đơn', message: getErrorMessage(e) },
      )
    } finally {
      setPendingId(null)
    }
  }

  const meta = orders.data?.meta
  const tileValue = (status: OrderStatus) => counts?.[status] ?? 0
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Quản lý đơn hàng</h1>
        <p className="mt-1 text-sm text-slate-500">Xử lý đơn theo thứ tự đặt trước làm trước</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Cần xác nhận" value={tileValue('PAID')} hint="Đã thanh toán, chờ kho" icon={CircleCheck} tone="sky" onClick={() => update({ status: 'PAID' })} active={tab === 'PAID'} />
        <StatTile label="Đang đóng gói" value={tileValue('PACKING')} hint="Đang chuẩn bị hàng" icon={PackageOpen} tone="violet" onClick={() => update({ status: 'PACKING' })} active={tab === 'PACKING'} />
        <StatTile label="Đang giao" value={tileValue('SHIPPING')} hint="Đã giao vận chuyển" icon={Truck} tone="cyan" onClick={() => update({ status: 'SHIPPING' })} active={tab === 'SHIPPING'} />
        <StatTile label="Chờ thanh toán" value={tileValue('PENDING_PAYMENT')} hint="Khách chưa thanh toán" icon={Clock} tone="amber" onClick={() => update({ status: 'PENDING_PAYMENT' })} active={tab === 'PENDING_PAYMENT'} />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <nav aria-label="Lọc theo trạng thái" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
          {TABS.map((t) => {
            const active = t.key === tab
            const count = t.key === 'all' || !counts ? null : counts[t.key]
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => update({ status: t.key === 'PAID' ? '' : t.key })}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'text-brand-700 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-600'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {t.label}
                {count !== null && count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-xs tabular-nums',
                      active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex flex-wrap items-end gap-3 p-4">
          <form
            role="search"
            className="relative min-w-60 flex-1"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              update({ q: searchDraft.trim() })
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Tìm mã đơn hoặc SĐT người nhận (Enter)"
              aria-label="Tìm mã đơn hoặc số điện thoại người nhận"
              maxLength={50}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
            />
          </form>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Từ ngày
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => update({ from: e.target.value })}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Đến ngày
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => update({ to: e.target.value })}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-brand-500"
            />
          </label>
          <select
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value === 'newest' ? 'newest' : '' })}
            aria-label="Sắp xếp"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500"
          >
            <option value="oldest">Cũ nhất trước</option>
            <option value="newest">Mới nhất trước</option>
          </select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" aria-hidden />
              Xoá lọc
            </Button>
          )}
        </div>

        {orders.isPending ? (
          <div className="space-y-2 border-t border-slate-100 p-4" aria-label="Đang tải">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : orders.isError ? (
          <div className="border-t border-slate-100 p-6">
            <Alert variant="error">Không tải được danh sách đơn. {getErrorMessage(orders.error)}</Alert>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => orders.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : orders.data.items.length === 0 ? (
          <div className="border-t border-slate-100">
            <EmptyState
              icon={PackageOpen}
              title="Không có đơn nào"
              description={hasFilters ? 'Thử bỏ bớt bộ lọc hoặc tìm với từ khoá khác.' : 'Chưa có đơn ở trạng thái này.'}
            />
          </div>
        ) : (
          <div
            className={cn('overflow-x-auto border-t border-slate-100 transition-opacity', orders.isPlaceholderData && 'opacity-60')}
            aria-busy={orders.isFetching}
          >
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Mã đơn</th>
                  <th className="px-4 py-3">Ngày đặt</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Người nhận</th>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3 text-right">Tổng tiền</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.data.items.map((order) => {
                  const [time, date] = formatDateTime(order.createdAt).split(', ')
                  return (
                    <tr key={order.id} className={cn('align-top', pendingId === order.id && 'bg-brand-50/40')}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center">
                          <Link
                            to={staffOrderPath(order.id)}
                            className={cn(
                              'font-semibold text-brand-700 hover:underline',
                              order.status === 'CANCELLED' && 'text-slate-400 line-through',
                            )}
                          >
                            {order.code}
                          </Link>
                          <CopyButton value={order.code} label="Sao chép mã đơn" />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {time}
                        <br />
                        <span className="text-xs text-slate-500">{date}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-900">{order.customer.fullName}</p>
                        <p className="text-xs text-slate-500">{order.customer.email}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-900">{order.recipientName}</p>
                        <p className="text-xs text-slate-500">{order.recipientPhone}</p>
                      </td>
                      <td className="max-w-56 px-4 py-3.5">
                        <p className="font-medium text-slate-900">
                          {order.itemCount} loại · {order.totalQuantity} món
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {order.previewItems.map((i) => i.productName).join(', ')}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900 tabular-nums">
                        {formatPrice(order.totalAmount)}
                      </td>
                      <td className="px-4 py-3.5">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {canProcess && order.nextStatus && (
                            <Button
                              size="sm"
                              onClick={() => advance(order)}
                              loading={pendingId === order.id}
                              loadingText="Đang cập nhật..."
                              disabled={pendingId !== null && pendingId !== order.id}
                            >
                              {ADVANCE_LABELS[order.nextStatus]}
                            </Button>
                          )}
                          {order.status === 'PENDING_PAYMENT' && (
                            <span className="text-xs whitespace-nowrap text-slate-500 italic">Chờ khách thanh toán</span>
                          )}
                          <Link
                            to={staffOrderPath(order.id)}
                            aria-label={`Xem chi tiết ${order.code}`}
                            title="Xem chi tiết"
                            className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Eye className="size-4" aria-hidden />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row">
            <p className="text-sm text-slate-500">
              Hiển thị {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} trong{' '}
              {meta.total} đơn
            </p>
            <Pagination page={meta.page} totalPages={meta.totalPages} onChange={(p) => update({ page: String(p) })} />
          </div>
        )}
      </section>

      {!canProcess && (
        <p className="mt-6 flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sky-600" aria-hidden />
          Bạn đang ở chế độ chỉ xem (Chăm sóc khách hàng): có thể tra cứu đơn nhưng không đổi trạng thái hay huỷ đơn.
        </p>
      )}

      {notice && (
        <Toast key={notice.id} variant={notice.variant} title={notice.title} onClose={() => setNotice(null)}>
          {notice.message}
        </Toast>
      )}
    </>
  )
}
