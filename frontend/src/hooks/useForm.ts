import { useState, type ChangeEvent, type FormEvent } from 'react'

export type FieldErrors<T> = Partial<Record<keyof T, string>>

/**
 * State form + kiểm tra phía client. Lỗi của một ô chỉ hiện sau khi người dùng
 * rời ô đó (blur) hoặc bấm gửi, để không báo đỏ khi đang gõ dở.
 */
export function useForm<T extends Record<string, string>>(
  initialValues: T,
  validate: (values: T) => FieldErrors<T>,
) {
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Lỗi do server trả về cho từng ô (vd email đã tồn tại); mất khi người dùng sửa ô đó
  const [serverErrors, setServerErrors] = useState<FieldErrors<T>>({})
  const errors = validate(values)

  const visibleError = (name: keyof T) =>
    (submitted || touched[name] ? errors[name] : undefined) ?? serverErrors[name]

  /** Props gắn vào TextField/PasswordField: `<TextField {...field('email')} />` */
  const field = (name: keyof T & string) => ({
    name,
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [name]: e.target.value }))
      setServerErrors((prev) => ({ ...prev, [name]: undefined }))
    },
    onBlur: () => setTouched((prev) => ({ ...prev, [name]: true })),
    error: visibleError(name),
  })

  const setFieldError = (name: keyof T, message: string) =>
    setServerErrors((prev) => ({ ...prev, [name]: message }))

  /**
   * Chỉ gọi onValid khi hết lỗi; ngược lại focus vào ô lỗi đầu tiên.
   * onValid trả Promise thì `submitting = true` cho tới khi xong (chặn bấm gửi 2 lần).
   */
  const handleSubmit =
    (onValid: (values: T) => void | Promise<void>) => async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (submitting) return
      setSubmitted(true)
      const firstInvalid = Object.keys(values).find((name) => errors[name as keyof T])
      if (firstInvalid) {
        const input = e.currentTarget.elements.namedItem(firstInvalid)
        if (input instanceof HTMLElement) input.focus()
        return
      }
      setSubmitting(true)
      try {
        await onValid(values)
      } finally {
        setSubmitting(false)
      }
    }

  return { values, errors, field, visibleError, setFieldError, submitting, handleSubmit }
}
