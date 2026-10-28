import type { FieldErrors } from '@/hooks/useForm'

// Quy tắc và thông báo khớp với backend (RegisterDto, LoginDto) để báo lỗi ngay trên form.
// Backend vẫn kiểm tra lại; frontend chỉ giúp người dùng sửa sớm.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^(0|\+84)\d{9,10}$/
// bcrypt chỉ dùng 72 byte đầu của mật khẩu
const MAX_PASSWORD_BYTES = 72

/** Hiển thị thành checklist dưới ô mật khẩu khi đăng ký. */
export const PASSWORD_RULES = [
  {
    label: 'Ít nhất 8 ký tự',
    message: 'Mật khẩu phải có ít nhất 8 ký tự',
    test: (password: string) => password.length >= 8,
  },
  {
    label: 'Gồm cả chữ và số',
    message: 'Mật khẩu phải gồm cả chữ và số',
    test: (password: string) => /[A-Za-z]/.test(password) && /\d/.test(password),
  },
]

export type LoginValues = {
  email: string
  password: string
}

export type RegisterValues = {
  fullName: string
  email: string
  phone: string
  password: string
  /** Chỉ kiểm tra ở frontend, không gửi lên backend */
  confirmPassword: string
}

function validateEmail(raw: string) {
  const email = raw.trim()
  if (!email) return 'Vui lòng nhập email'
  if (email.length > 254) return 'Email quá dài'
  if (!EMAIL_PATTERN.test(email)) return 'Email không hợp lệ'
}

function validateNewPassword(password: string) {
  if (!password) return 'Vui lòng nhập mật khẩu'
  const failed = PASSWORD_RULES.find((rule) => !rule.test(password))
  if (failed) return failed.message
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return 'Mật khẩu quá dài (tối đa 72 byte)'
  }
}

export function isPasswordRuleMessage(message: string | undefined) {
  return PASSWORD_RULES.some((rule) => rule.message === message)
}

export function validateLogin(values: LoginValues): FieldErrors<LoginValues> {
  return {
    email: validateEmail(values.email),
    password: values.password ? undefined : 'Vui lòng nhập mật khẩu',
  }
}

export function validateRegister(values: RegisterValues): FieldErrors<RegisterValues> {
  const fullName = values.fullName.trim()
  const phone = values.phone.trim()
  return {
    fullName: !fullName
      ? 'Họ tên không được để trống'
      : fullName.length > 100
        ? 'Họ tên tối đa 100 ký tự'
        : undefined,
    email: validateEmail(values.email),
    phone: phone && !PHONE_PATTERN.test(phone) ? 'Số điện thoại không hợp lệ' : undefined,
    password: validateNewPassword(values.password),
    confirmPassword: !values.confirmPassword
      ? 'Vui lòng nhập lại mật khẩu'
      : values.confirmPassword !== values.password
        ? 'Mật khẩu nhập lại không khớp'
        : undefined,
  }
}
