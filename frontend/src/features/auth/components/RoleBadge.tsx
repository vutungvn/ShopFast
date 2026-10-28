import { cn } from '@/lib/cn'
import { ROLE_LABELS } from '../roles'
import type { Role } from '../types'

const ROLE_STYLES: Record<Role, string> = {
  CUSTOMER: 'bg-slate-100 text-slate-700 ring-slate-200',
  SUPPORT: 'bg-sky-50 text-sky-700 ring-sky-200',
  WAREHOUSE: 'bg-amber-50 text-amber-800 ring-amber-200',
  ADMIN: 'bg-red-50 text-red-700 ring-red-200',
}

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        ROLE_STYLES[role],
        className,
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}
