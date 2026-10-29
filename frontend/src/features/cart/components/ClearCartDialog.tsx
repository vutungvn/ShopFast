import { Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

type ClearCartDialogProps = {
  open: boolean
  itemCount: number
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
  error?: string | null
}

/** Xác nhận xoá hết giỏ. Dùng <dialog> gốc: có sẵn khoá focus, phím Esc và lớp nền mờ. */
export function ClearCartDialog({
  open,
  itemCount,
  onClose,
  onConfirm,
  loading = false,
  error,
}: ClearCartDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="clear-cart-title"
      aria-describedby="clear-cart-description"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-6 shadow-xl backdrop:bg-slate-900/40"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <Trash2 className="size-6" aria-hidden />
      </span>
      <h2 id="clear-cart-title" className="mt-4 text-lg font-semibold text-slate-900">
        Xoá toàn bộ giỏ hàng?
      </h2>
      <p id="clear-cart-description" className="mt-1.5 text-sm text-slate-500">
        {itemCount} sản phẩm sẽ bị xoá khỏi giỏ. Bạn không thể hoàn tác thao tác này.
      </p>
      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Huỷ
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading} loadingText="Đang xoá...">
          Xoá tất cả
        </Button>
      </div>
    </dialog>
  )
}
