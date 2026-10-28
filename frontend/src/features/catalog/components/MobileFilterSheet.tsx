import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

type MobileFilterSheetProps = {
  open: boolean
  onClose: () => void
  onClear: () => void
  total?: number
  children: ReactNode
}

/**
 * Bộ lọc dạng bottom sheet trên mobile. Dùng <dialog> gốc của trình duyệt:
 * có sẵn khoá focus bên trong, phím Esc và lớp nền mờ.
 */
export function MobileFilterSheet({ open, onClose, onClear, total, children }: MobileFilterSheetProps) {
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
      aria-labelledby="filter-sheet-title"
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-2xl bg-white p-0 backdrop:bg-slate-900/40 lg:hidden"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="filter-sheet-title" className="text-base font-semibold text-slate-900">
            Bộ lọc
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bộ lọc"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-5 py-4">
          <Button variant="outline" onClick={onClear}>
            Xoá tất cả
          </Button>
          <Button onClick={onClose}>
            {total === undefined ? 'Xem kết quả' : `Xem ${total} sản phẩm`}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
