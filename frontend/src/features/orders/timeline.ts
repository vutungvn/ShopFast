import { ROLE_LABELS } from '@/features/auth/roles'
import type { TimelineEntry } from './types'

/** Ai đổi trạng thái: khách thấy "Bạn / Nhân viên kho / Hệ thống"; nhân viên thấy tên người đổi */
export function actorLabel(entry: TimelineEntry, viewer: 'customer' | 'staff') {
  if (entry.actor === 'SYSTEM') return 'Hệ thống'
  if (viewer === 'staff' && entry.changedBy) {
    return `${entry.changedBy.fullName} (${ROLE_LABELS[entry.changedBy.role]})`
  }
  if (entry.actor === 'CUSTOMER') return viewer === 'customer' ? 'Bạn' : 'Khách hàng'
  return 'Nhân viên kho'
}
