import { cn } from '@/lib/cn'
import { ACTION_STATUS, CATEGORY_LABELS, TICKET_STATUS } from '../labels'
import type { AgentActionStatus, TicketCategory, TicketStatus } from '../types'

const pill =
  'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset'

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <span className={cn(pill, TICKET_STATUS[status].pill)}>{TICKET_STATUS[status].label}</span>
}

/** Nhóm do AI phân loại; chưa phân loại thì không hiện */
export function CategoryBadge({ category }: { category: TicketCategory | null }) {
  if (!category) return null
  return <span className={cn(pill, 'bg-violet-50 text-violet-700 ring-violet-200')}>{CATEGORY_LABELS[category]}</span>
}

export function ActionStatusBadge({ status }: { status: AgentActionStatus }) {
  return <span className={cn(pill, ACTION_STATUS[status].pill)}>{ACTION_STATUS[status].label}</span>
}
