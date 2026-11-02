import type { ConnectionState } from '@/api/socket'
import { cn } from '@/lib/cn'

const STATES: Record<ConnectionState, { label: string; dot: string; hint: string }> = {
  connected: {
    label: 'Trực tiếp',
    dot: 'bg-emerald-500',
    hint: 'Trạng thái đơn tự cập nhật, không cần tải lại trang',
  },
  connecting: {
    label: 'Đang kết nối lại…',
    dot: 'animate-pulse bg-amber-500',
    hint: 'Mất kết nối realtime, đang thử nối lại. Nối lại xong sẽ tự cập nhật',
  },
  offline: {
    label: 'Mất kết nối',
    dot: 'bg-slate-400',
    hint: 'Trạng thái đơn chưa tự cập nhật; tải lại trang để xem mới nhất',
  },
}

/** Nhãn trạng thái kết nối realtime cạnh tiêu đề đơn / danh sách đơn */
export function LiveBadge({ state, className }: { state: ConnectionState; className?: string }) {
  const { label, dot, hint } = STATES[state]
  return (
    <span
      role="status"
      title={hint}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200',
        className,
      )}
    >
      <span className={cn('size-2 rounded-full', dot)} aria-hidden />
      {label}
    </span>
  )
}
