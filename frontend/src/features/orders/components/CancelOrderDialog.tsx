import { PackageOpen, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { getErrorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'

const MAX_REASON = 500
/** Khớp backend: nhân viên huỷ phải ghi lý do ít nhất 5 ký tự */
const MIN_STAFF_REASON = 5

const QUICK_REASONS = {
  customer: ['Đổi ý không mua nữa', 'Muốn đổi địa chỉ nhận hàng', 'Tìm thấy giá tốt hơn', 'Đặt nhầm sản phẩm'],
  staff: ['Hết hàng tại kho', 'Khách yêu cầu huỷ', 'Sai sót địa chỉ', 'Không liên lạc được khách'],
}

type CancelOrderDialogProps = {
  open: boolean
  onClose: () => void
  /** Khách: lý do tuỳ chọn. Nhân viên: bắt buộc lý do */
  mode: 'customer' | 'staff'
  code: string
  totalAmount: number
  /** Đơn đã thanh toán => ghi nhận hoàn tiền (giả lập) */
  paid: boolean
  onConfirm: (reason: string) => Promise<void>
}

export function CancelOrderDialog(props: CancelOrderDialogProps) {
  // key: mở lại thì lý do và lỗi cũ được xoá
  return <CancelOrderDialogContent key={String(props.open)} {...props} />
}

function CancelOrderDialogContent({ open, onClose, mode, code, totalAmount, paid, onConfirm }: CancelOrderDialogProps) {
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const required = mode === 'staff'
  const reasonError =
    required && submitted && reason.trim().length < MIN_STAFF_REASON
      ? `Vui lòng nhập lý do (ít nhất ${MIN_STAFF_REASON} ký tự)`
      : undefined

  const confirm = async () => {
    setSubmitted(true)
    if (required && reason.trim().length < MIN_STAFF_REASON) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
      onClose()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      tone="danger"
      icon={TriangleAlert}
      eyebrow="Xác nhận huỷ"
      title={`Huỷ đơn ${code}?`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Không huỷ
          </Button>
          <Button variant="danger" onClick={confirm} loading={busy} loadingText="Đang huỷ...">
            Huỷ đơn
          </Button>
        </>
      }
    >
      <div className="flex gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
        <PackageOpen className="mt-0.5 size-4.5 shrink-0" aria-hidden />
        <div>
          <p>Hàng trong đơn sẽ được trả lại kho.</p>
          {paid && (
            <p className="mt-1">
              Đơn đã thanh toán: ghi nhận hoàn tiền <strong>{formatPrice(totalAmount)}</strong> (giả lập, không có
              giao dịch thật).
            </p>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}

      <p className="mt-5 text-sm font-medium text-slate-700">Chọn nhanh lý do:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_REASONS[mode].map((quick) => (
          <button
            key={quick}
            type="button"
            onClick={() => setReason(quick)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm transition-colors',
              reason === quick
                ? 'bg-red-50 font-medium text-red-700 ring-1 ring-red-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}
          >
            {quick}
          </button>
        ))}
      </div>

      <TextAreaField
        className="mt-4"
        label="Lý do huỷ"
        hint={required ? undefined : '(không bắt buộc)'}
        required={required}
        placeholder={required ? 'Lý do sẽ được lưu vào lịch sử đơn để khách và CSKH xem lại' : 'Nhập lý do huỷ đơn...'}
        maxLength={MAX_REASON}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={reasonError}
      />
    </Dialog>
  )
}
