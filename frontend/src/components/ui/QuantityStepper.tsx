import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'

type QuantityStepperProps = {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
  label?: string
}

const buttonClass =
  'flex size-10 items-center justify-center text-slate-600 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40'

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled = false,
  label = 'Số lượng',
}: QuantityStepperProps) {
  // Cho gõ tự do, chỉ chốt (giới hạn trong [min, max]) khi rời ô
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  const commit = () => {
    if (draft !== null) onChange(clamp(Number(draft) || min))
    setDraft(null)
  }

  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white',
        disabled && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Giảm số lượng"
        className={buttonClass}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={draft ?? String(value)}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="h-10 w-12 border-x border-slate-200 text-center text-base font-semibold text-slate-900 outline-none disabled:bg-transparent"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Tăng số lượng"
        className={buttonClass}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}
