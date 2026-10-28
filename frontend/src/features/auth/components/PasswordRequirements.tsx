import { Circle, CircleCheck, CircleX } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PASSWORD_RULES } from '../validation'

type PasswordRequirementsProps = {
  id: string
  password: string
  /** Sau khi đã bấm gửi/rời ô: điều kiện chưa đạt chuyển đỏ thay vì xám */
  showErrors: boolean
}

export function PasswordRequirements({ id, password, showErrors }: PasswordRequirementsProps) {
  return (
    <ul id={id} className="mt-2 space-y-1" aria-label="Yêu cầu mật khẩu">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        const Icon = met ? CircleCheck : showErrors ? CircleX : Circle
        return (
          <li
            key={rule.label}
            className={cn(
              'flex items-center gap-2 text-[13px] transition-colors',
              met ? 'text-emerald-600' : showErrors ? 'text-red-600' : 'text-slate-500',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {rule.label}
            <span className="sr-only">{met ? '(đã đạt)' : '(chưa đạt)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
