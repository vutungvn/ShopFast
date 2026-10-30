import { ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PATHS } from '@/app/paths'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { buttonClasses } from '@/components/ui/button-styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { getErrorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/cn'
import { CancelOrderDialog } from '../components/CancelOrderDialog'
import { OrderCard } from '../components/OrderCard'
import { useCancelOrder, useMyOrders } from '../queries'
import { CUSTOMER_TABS, type CustomerTab } from '../order-status'
import type { OrderSummary } from '../types'

const PAGE_SIZE = 5

export function OrdersPage() {
  return (
    <>
      <title>Đơn mua · ShopFast</title>
      <Breadcrumb items={[{ label: 'Trang chủ', to: PATHS.home }, { label: 'Đơn mua' }]} />
      <MyOrders />
    </>
  )
}

function MyOrders() {
  // Tab và trang lưu trên URL: F5 hay bấm Back vẫn đúng chỗ
  const [params, setParams] = useSearchParams()
  const tab = CUSTOMER_TABS.find((t) => t.key === params.get('tab')) ?? CUSTOMER_TABS[0]
  const page = Math.max(1, Number(params.get('page')) || 1)
  const orders = useMyOrders(tab.statuses, page, PAGE_SIZE)
  const cancelOrder = useCancelOrder()
  const now = useNow()
  const [cancelling, setCancelling] = useState<OrderSummary | null>(null)

  const go = (next: { tab?: CustomerTab; page?: number }) => {
    const search = new URLSearchParams()
    const nextTab = next.tab ?? tab.key
    if (nextTab !== 'all') search.set('tab', nextTab)
    if (next.page && next.page > 1) search.set('page', String(next.page))
    setParams(search)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const meta = orders.data?.meta
  return (
    <>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Đơn mua</h1>
      </div>

      <nav
        aria-label="Lọc theo trạng thái"
        className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5"
      >
        {CUSTOMER_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => go({ tab: t.key })}
            aria-current={t.key === tab.key ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              t.key === tab.key ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div
        className={cn('mt-5 space-y-4 transition-opacity', orders.isPlaceholderData && 'opacity-60')}
        aria-busy={orders.isFetching}
      >
        {orders.isPending ? (
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))
        ) : orders.isError ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <Alert variant="error">Không tải được đơn hàng. {getErrorMessage(orders.error)}</Alert>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => orders.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : orders.data.items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <EmptyState
              icon={ReceiptText}
              title={tab.key === 'all' ? 'Bạn chưa có đơn hàng nào' : `Không có đơn “${tab.label}”`}
              description="Đơn hàng bạn đặt sẽ hiện ở đây để theo dõi trạng thái."
              action={
                <Link to={PATHS.home} className={buttonClasses()}>
                  Khám phá sản phẩm
                </Link>
              }
            />
          </div>
        ) : (
          orders.data.items.map((order) => (
            <OrderCard key={order.id} order={order} now={now} onCancel={() => setCancelling(order)} />
          ))
        )}
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-slate-500">
            Hiển thị {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} trong{' '}
            {meta.total} đơn hàng
          </p>
          <Pagination page={meta.page} totalPages={meta.totalPages} onChange={(p) => go({ page: p })} />
        </div>
      )}

      <CancelOrderDialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        mode="customer"
        code={cancelling?.code ?? ''}
        totalAmount={cancelling?.totalAmount ?? 0}
        paid={cancelling?.status === 'PAID'}
        onConfirm={async (reason) => {
          // Không dùng `cancelling!.id`: React Compiler đọc `cancelling.id` ngay lúc render để ghi nhớ hàm,
          // khi chưa mở hộp thoại (cancelling = null) sẽ lỗi
          if (!cancelling) return
          await cancelOrder.mutateAsync({ orderId: cancelling.id, reason })
        }}
      />
    </>
  )
}
