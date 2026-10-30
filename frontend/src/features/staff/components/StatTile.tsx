import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

const TONES = {
  slate: 'bg-slate-100 text-slate-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
}

type StatTileProps = {
  label: string
  value: number
  hint?: string
  icon: LucideIcon
  tone: keyof typeof TONES
  /** Bấm vào để lọc theo ô này */
  onClick?: () => void
  active?: boolean
}

/** Ô số liệu ở đầu các trang nhân viên */
export function StatTile({ label, value, hint, icon: Icon, tone, onClick, active = false }: StatTileProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        'flex flex-col rounded-2xl border bg-white p-5 text-left transition',
        active ? 'border-brand-500 ring-2 ring-brand-500/15' : 'border-slate-200',
        onClick && 'hover:border-brand-500/40 hover:shadow-md hover:shadow-slate-200/60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className={cn('flex size-9 items-center justify-center rounded-xl', TONES[tone])}>
          <Icon className="size-4.5" aria-hidden />
        </span>
      </div>
      <span className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</span>
      {hint && <span className="mt-1 text-xs text-slate-500">{hint}</span>}
    </Tag>
  )
}
