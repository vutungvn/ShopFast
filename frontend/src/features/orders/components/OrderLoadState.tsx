import { PackageSearch } from 'lucide-react'
import { Link } from 'react-router'
import { getErrorMessage, getErrorStatus } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { EmptyState } from '@/components/ui/EmptyState'

type OrderLoadStateProps = {
  isPending: boolean
  error: unknown
  refetch: () => void
  /** Trang quay về khi không tìm thấy đơn */
  backTo: string
  backLabel: string
}

/** Đang tải / không tìm thấy (404, gồm cả đơn của người khác) / lỗi khác của các trang chi tiết đơn */
export function OrderLoadState({ isPending, error, refetch, backTo, backLabel }: OrderLoadStateProps) {
  if (isPending) {
    return (
      <div className="animate-pulse space-y-6" aria-label="Đang tải đơn hàng">
        <div className="h-24 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-32 rounded-2xl border border-slate-200 bg-white" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-80 rounded-2xl border border-slate-200 bg-white" />
          <div className="h-80 rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    )
  }

  if (getErrorStatus(error) === 404 || getErrorStatus(error) === 400) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white">
        <title>Không tìm thấy đơn hàng · ShopFast</title>
        <EmptyState
          icon={PackageSearch}
          title="Không tìm thấy đơn hàng"
          description="Đơn không tồn tại hoặc bạn không có quyền xem đơn này."
          action={
            <Link to={backTo} className={buttonClasses()}>
              {backLabel}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <Alert variant="error">Không tải được đơn hàng. {getErrorMessage(error)}</Alert>
      <Button variant="outline" size="sm" className="mt-4" onClick={refetch}>
        Thử lại
      </Button>
    </div>
  )
}
