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
  const errors = validate(values)

  const visibleError = (name: keyof T) =>
    submitted || touched[name] ? errors[name] : undefined

  /** Props gắn vào TextField/PasswordField: `<TextField {...field('email')} />` */
  const field = (name: keyof T & string) => ({
    name,
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      setValues((prev) => ({ ...prev, [name]: e.target.value })),
    onBlur: () => setTouched((prev) => ({ ...prev, [name]: true })),
    error: visibleError(name),
  })

  /** Chỉ gọi onValid khi hết lỗi; ngược lại focus vào ô lỗi đầu tiên. */
  const handleSubmit = (onValid: (values: T) => void) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitted(true)
    const firstInvalid = Object.keys(values).find((name) => errors[name as keyof T])
    if (firstInvalid) {
      const input = e.currentTarget.elements.namedItem(firstInvalid)
      if (input instanceof HTMLElement) input.focus()
      return
    }
    onValid(values)
  }

  return { values, errors, field, visibleError, handleSubmit }
}
