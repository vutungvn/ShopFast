import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { cn } from '@/lib/cn'

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  /** Chú thích nhỏ cạnh nhãn, vd "(không bắt buộc)" */
  hint?: string
  /** Chuỗi: hiện lỗi dưới ô. `true`: chỉ tô đỏ (lỗi đã được thể hiện ở chỗ khác) */
  error?: string | boolean
  /** Phần tử đặt bên phải trong ô, vd nút ẩn/hiện mật khẩu */
  endAdornment?: ReactNode
  ref?: Ref<HTMLInputElement>
}

export function TextField({
  label,
  hint,
  error,
  required,
  endAdornment,
  className,
  'aria-describedby': describedBy,
  ...inputProps
}: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const errorText = typeof error === 'string' ? error : undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        )}
        {hint && <span className="ml-1.5 text-xs font-normal text-slate-400">{hint}</span>}
      </label>

      <div className="relative">
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(errorText && errorId, describedBy) || undefined}
          className={cn(
            'h-11 w-full rounded-lg border bg-white px-3.5 text-base text-slate-900 transition-colors outline-none',
            'placeholder:text-slate-400 focus:ring-3',
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
              : 'border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:ring-brand-500/15',
            endAdornment != null && 'pr-12',
          )}
          {...inputProps}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{endAdornment}</div>
        )}
      </div>

      {errorText && (
        <p id={errorId} className="mt-1.5 text-[13px] text-red-600">
          {errorText}
        </p>
      )}
    </div>
  )
}
