import { Ban, Check, XCircle } from 'lucide-react'
import { useState } from 'react'
import { getErrorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { useReviewAction } from '../queries'

const MIN_REASON = 5

/** Nút Duyệt / Từ chối đề xuất của trợ lý AI (chỉ hiện khi đề xuất còn chờ duyệt) */
export function ActionReview({ actionId, orderCode }: { actionId: string; orderCode: string }) {
  const review = useReviewAction()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = async (reject?: string) => {
    setError(null)
    try {
      await review.mutateAsync({ id: actionId, reject })
      setRejectOpen(false)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }
  const rejecting = review.isPending && review.variables?.reject !== undefined

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={review.isPending && !rejecting} disabled={review.isPending} onClick={() => run()}>
          <Check className="size-4" aria-hidden />
          Duyệt & huỷ đơn
        </Button>
        <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => setRejectOpen(true)}>
          <XCircle className="size-4" aria-hidden />
          Từ chối
        </Button>
      </div>
      {error && !rejectOpen && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={`Từ chối huỷ đơn ${orderCode}`}
        eyebrow="Đề xuất của trợ lý AI"
        icon={Ban}
        tone="danger"
        busy={rejecting}
        footer={
          <>
            <Button variant="outline" disabled={rejecting} onClick={() => setRejectOpen(false)}>
              Quay lại
            </Button>
            <Button
              variant="danger"
              loading={rejecting}
              disabled={reason.trim().length < MIN_REASON}
              onClick={() => run(reason.trim())}
            >
              Từ chối đề xuất
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-600">Lý do sẽ được gửi vào hội thoại để khách biết. Đơn giữ nguyên.</p>
        <TextAreaField
          label="Lý do từ chối"
          required
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={error ?? undefined}
          placeholder="Vd: Đơn đã đóng gói xong, em sẽ liên hệ để giao sớm"
        />
      </Dialog>
    </div>
  )
}
