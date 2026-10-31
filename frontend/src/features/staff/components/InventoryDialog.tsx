import { ArrowLeftRight, ArrowRight, ClipboardCheck, Info, Minus, PackageCheck, Plus, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { getErrorMessage } from '@/api/errors'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ProductImage } from '@/features/catalog/components/ProductImage'
import type { Product } from '@/features/catalog/types'
import { cn } from '@/lib/cn'
import { MAX_STOCK } from '../api'
import { useUpdateInventory } from '../queries'

type Mode = 'delta' | 'set'

type InventoryDialogProps = {
  product: Product | null
  onClose: () => void
  onSaved: (product: Product, before: number) => void
}

export function InventoryDialog({ product, onClose, onSaved }: InventoryDialogProps) {
  // key: mỗi lần mở cho sản phẩm khác thì làm lại form từ đầu
  return (
    <Dialog
      open={product !== null}
      onClose={onClose}
      icon={PackageCheck}
      eyebrow="Cập nhật tồn kho"
      title={product?.name ?? ''}
      className="max-w-xl"
    >
      {product && <InventoryForm key={product.id} product={product} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  )
}

function InventoryForm({ product, onClose, onSaved }: { product: Product } & Omit<InventoryDialogProps, 'product'>) {
  const updateInventory = useUpdateInventory()
  const [mode, setMode] = useState<Mode>('delta')
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [quantity, setQuantity] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amount = Number(quantity)
  const validNumber = quantity !== '' && Number.isInteger(amount) && amount <= MAX_STOCK
  const after =
    mode === 'set' ? amount : direction === 'in' ? product.stock + amount : product.stock - amount
  const clientError = !validNumber
    ? quantity === ''
      ? null
      : `Nhập số nguyên từ ${mode === 'set' ? 0 : 1} đến ${MAX_STOCK.toLocaleString('vi-VN')}`
    : mode === 'delta' && amount === 0
      ? 'Số lượng phải lớn hơn 0'
      : mode === 'delta' && after < 0
        ? `Không đủ tồn kho để trừ ${amount} (còn ${product.stock})`
        : null
  const canSave = validNumber && !clientError && !(mode === 'set' && amount === product.stock)

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      const updated = await updateInventory.mutateAsync({
        productId: product.id,
        change: mode === 'set' ? { stock: amount } : { delta: direction === 'in' ? amount : -amount },
      })
      onSaved(updated, product.stock)
      onClose()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setQuantity('')
    setError(null)
  }
  const step = (by: number) => setQuantity(String(Math.max(0, (Number(quantity) || 0) + by)))

  return (
    <>
      <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-3">
        <ProductImage
          categorySlug={product.category.slug}
          src={product.imageUrl}
          size="thumb"
          className="size-14 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">SKU: {product.sku}</p>
          <p className="text-sm text-slate-600">{product.category.name} · {product.brand.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Tồn hiện tại</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{product.stock}</p>
        </div>
      </div>

      <div role="tablist" aria-label="Cách cập nhật" className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            ['delta', 'Nhập / xuất hàng', ArrowLeftRight],
            ['set', 'Kiểm kê (đặt lại)', ClipboardCheck],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => switchMode(key)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              mode === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {mode === 'delta' && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              ['in', 'Nhập thêm (+)', Plus],
              ['out', 'Xuất bớt (−)', Minus],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              aria-pressed={direction === key}
              onClick={() => setDirection(key)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                direction === key
                  ? key === 'in'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      )}

      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="inventory-amount">
        {mode === 'set' ? 'Số tồn thực tế' : 'Số lượng'}
        <span className="ml-0.5 text-red-600" aria-hidden>
          *
        </span>
      </label>
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Giảm"
          className="flex size-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <input
          id="inventory-amount"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="0"
          autoFocus
          className={cn(
            'h-11 min-w-0 flex-1 rounded-lg border px-3 text-center text-lg font-semibold tabular-nums outline-none focus:ring-3',
            clientError
              ? 'border-red-500 focus:ring-red-500/15'
              : 'border-slate-200 focus:border-brand-500 focus:ring-brand-500/15',
          )}
        />
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Tăng"
          className="flex size-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>

      {validNumber && !clientError && (
        <p className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm">
          <span className="text-slate-600">Sau cập nhật</span>
          <span className="flex items-center gap-2 font-semibold tabular-nums">
            <span className="text-slate-500">{product.stock}</span>
            <ArrowRight className="size-4 text-slate-400" aria-hidden />
            <span className={after > product.stock ? 'text-emerald-700' : after < product.stock ? 'text-red-600' : 'text-slate-900'}>
              {after}
            </span>
          </span>
        </p>
      )}
      {clientError && <p className="mt-2 text-[13px] text-red-600">{clientError}</p>}
      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      {mode === 'delta' ? (
        <p className="mt-4 flex gap-2.5 rounded-lg bg-sky-50 px-3.5 py-3 text-sm text-sky-900">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Dùng khi nhập hàng hoặc xuất hỏng, thất lạc. An toàn khi khách đang đặt đơn cùng lúc.
        </p>
      ) : (
        <p className="mt-4 flex gap-2.5 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Ghi đè số tồn hiện tại bằng đúng số bạn nhập. Chỉ dùng khi kiểm kê thực tế.
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Huỷ
        </Button>
        <Button onClick={save} disabled={!canSave} loading={busy} loadingText="Đang lưu...">
          Lưu thay đổi
        </Button>
      </div>
    </>
  )
}
