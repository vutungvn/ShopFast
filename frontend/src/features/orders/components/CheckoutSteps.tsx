import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

const STEPS = ['Giỏ hàng', 'Thông tin nhận hàng', 'Thanh toán']

/** Thanh 3 bước mua hàng. `current` từ 1; `done` = đã xong cả bước cuối (thanh toán thành công) */
export function CheckoutSteps({ current, done = false }: { current: 1 | 2 | 3; done?: boolean }) {
  return (
    <ol className="mx-auto grid max-w-2xl grid-cols-3" aria-label="Các bước đặt hàng">
      {STEPS.map((label, index) => {
        const step = index + 1
        const complete = done || step < current
        const active = !done && step === current
        return (
          <li key={label} className="relative flex flex-col items-center text-center">
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2',
                  complete || active ? (done ? 'bg-emerald-500' : 'bg-brand-600') : 'bg-slate-200',
                )}
              />
            )}
            <span
              className={cn(
                'relative flex size-8 items-center justify-center rounded-full text-sm font-semibold ring-4',
                complete && (done ? 'bg-emerald-500 text-white ring-white' : 'bg-brand-600 text-white ring-white'),
                active && 'bg-brand-600 text-white ring-brand-100',
                !complete && !active && 'bg-slate-100 text-slate-400 ring-white',
              )}
            >
              {complete ? <Check className="size-4" aria-hidden /> : step}
            </span>
            <span
              aria-current={active ? 'step' : undefined}
              className={cn(
                'mt-2 text-xs font-medium sm:text-sm',
                active ? 'text-brand-700' : complete ? 'text-slate-700' : 'text-slate-400',
              )}
            >
              {done && step === 3 ? 'Hoàn tất' : label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
