import { useId } from 'react'
import { Link } from 'react-router'
import { PATHS } from '@/app/paths'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/PasswordField'
import { TextField } from '@/components/ui/TextField'
import { useForm } from '@/hooks/useForm'
import { AuthHeading } from '../components/AuthHeading'
import { PasswordRequirements } from '../components/PasswordRequirements'
import { isPasswordRuleMessage, validateRegister, type RegisterValues } from '../validation'

const INITIAL_VALUES: RegisterValues = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
}

export function RegisterPage() {
  const requirementsId = useId()
  const { values, field, handleSubmit } = useForm(INITIAL_VALUES, validateRegister)

  // Lỗi "chưa đủ 8 ký tự / thiếu chữ hoặc số" đã hiện trên checklist nên chỉ tô đỏ ô, không lặp chữ
  const passwordField = field('password')
  const passwordRuleFailed = isPasswordRuleMessage(passwordField.error)

  const onSubmit = handleSubmit(() => {
    // Chưa ghép API: bước sau gọi POST /auth/register (không gửi confirmPassword),
    // thành công thì navigate(PATHS.login, { state: { notice: 'registered', email } })
  })

  return (
    <>
      <AuthHeading title="Tạo tài khoản" description="Đăng ký để bắt đầu mua sắm cùng ShopFast" />

      <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
        <TextField
          label="Họ và tên"
          required
          autoComplete="name"
          placeholder="Nguyễn Văn A"
          maxLength={100}
          autoFocus
          {...field('fullName')}
        />
        <TextField
          label="Email"
          required
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ban@email.com"
          {...field('email')}
        />
        <TextField
          label="Số điện thoại"
          hint="(không bắt buộc)"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0912345678"
          {...field('phone')}
        />
        <div>
          <PasswordField
            label="Mật khẩu"
            required
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            aria-describedby={requirementsId}
            {...passwordField}
            error={passwordRuleFailed || passwordField.error}
          />
          <PasswordRequirements
            id={requirementsId}
            password={values.password}
            showErrors={passwordRuleFailed}
          />
        </div>
        <PasswordField
          label="Nhập lại mật khẩu"
          required
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          {...field('confirmPassword')}
        />
        <Button type="submit" className="mt-2 w-full" loadingText="Đang tạo tài khoản…">
          Đăng ký
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Đã có tài khoản?{' '}
        <Link
          to={PATHS.login}
          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </>
  )
}
