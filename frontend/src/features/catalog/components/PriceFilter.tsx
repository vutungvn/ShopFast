import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

const PRESETS: Array<{ label: string; min?: number; max?: number }> = [
  { label: 'Dưới 1 triệu', max: 1_000_000 },
  { label: '1 – 5 triệu', min: 1_000_000, max: 5_000_000 },
  { label: '5 – 15 triệu', min: 5_000_000, max: 15_000_000 },
  { label: 'Trên 15 triệu', min: 15_000_000 },
]

type PriceFilterProps = {
  min?: number
  max?: number
  onApply: (range: { minPrice?: number; maxPrice?: number }) => void
}

const toDigits = (value: string) => value.replace(/\D/g, '').slice(0, 13)
const toAmount = (digits: string) => (digits ? Number(digits) : undefined)
const display = (digits: string) => (digits ? formatNumber(Number(digits)) : '')

/** Gõ xong bấm "Áp dụng" mới lọc, tránh gọi API theo từng phím. Cha đặt `key` để đồng bộ lại khi URL đổi. */
export function PriceFilter({ min, max, onApply }: PriceFilterProps) {
  const [minDigits, setMinDigits] = useState(min !== undefined ? String(min) : '')
  const [maxDigits, setMaxDigits] = useState(max !== undefined ? String(max) : '')
  const minAmount = toAmount(minDigits)
  const maxAmount = toAmount(maxDigits)
  const invalid = minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!invalid) onApply({ minPrice: minAmount, maxPrice: maxAmount })
  }

  const inputClass = cn(
    'h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:ring-3',
    invalid ? 'border-red-500 focus:ring-red-500/15' : 'border-slate-200 focus:border-brand-500 focus:ring-brand-500/15',
  )

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500">
          Từ
          <input
            inputMode="numeric"
            value={display(minDigits)}
            onChange={(e) => setMinDigits(toDigits(e.target.value))}
            placeholder="0"
            className={cn(inputClass, 'mt-1')}
          />
        </label>
        <label className="text-xs text-slate-500">
          Đến
          <input
            inputMode="numeric"
            value={display(maxDigits)}
            onChange={(e) => setMaxDigits(toDigits(e.target.value))}
            placeholder="Tối đa"
            className={cn(inputClass, 'mt-1')}
          />
        </label>
      </div>
      {invalid && <p className="mt-1.5 text-xs text-red-600">Giá "Từ" không được lớn hơn giá "Đến"</p>}
      <Button type="submit" variant="outline" size="sm" className="mt-3 w-full" disabled={invalid}>
        Áp dụng
      </Button>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const active = preset.min === min && preset.max === max
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onApply({ minPrice: preset.min, maxPrice: preset.max })}
              aria-pressed={active}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
    </form>
  )
}
