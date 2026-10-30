import { useId, type Ref, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'value'> & {
  label: string
  /** Chú thích nhỏ cạnh nhãn, vd "(không bắt buộc)" */
  hint?: string
  error?: string | boolean
  value: string
  ref?: Ref<HTMLTextAreaElement>
}

/** Ô nhập nhiều dòng, cùng kiểu TextField; có `maxLength` thì hiện bộ đếm ký tự. */
export function TextAreaField({
  label,
  hint,
  error,
  required,
  maxLength,
  value,
  className,
  rows = 3,
  ...textareaProps
}: TextAreaFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const errorText = typeof error === 'string' ? error : undefined

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
          {required && (
            <span className="ml-0.5 text-red-600" aria-hidden>
              *
            </span>
          )}
          {hint && <span className="ml-1.5 text-xs font-normal text-slate-400">{hint}</span>}
        </label>
        {maxLength && (
          <span className="text-xs text-slate-400 tabular-nums">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        id={id}
        required={required}
        maxLength={maxLength}
        value={value}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorText ? errorId : undefined}
        className={cn(
          'block w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-base text-slate-900 transition-colors outline-none',
          'placeholder:text-slate-400 focus:ring-3',
          error
            ? 'border-red-500 bg-red-50/30 focus:border-red-500 focus:ring-red-500/15'
            : 'border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:ring-brand-500/15',
        )}
        {...textareaProps}
      />
      {errorText && (
        <p id={errorId} className="mt-1.5 text-[13px] text-red-600">
          {errorText}
        </p>
      )}
    </div>
  )
}
