import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { getErrorMessage } from '@/api/errors'
import { PATHS } from '@/app/paths'
import { Alert, type AlertVariant } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/PasswordField'
import { TextField } from '@/components/ui/TextField'
import { useForm } from '@/hooks/useForm'
import { useAuth } from '../auth-context'
import { AuthHeading } from '../components/AuthHeading'
import type { LoginPageState } from '../types'
import { validateLogin, type LoginValues } from '../validation'

const NOTICES: Record<NonNullable<LoginPageState['notice']>, { variant: AlertVariant; text: string }> = {
  registered: { variant: 'success', text: 'Đăng ký thành công, hãy đăng nhập' },
  'logged-out': { variant: 'success', text: 'Bạn đã đăng xuất' },
  'session-expired': {
    variant: 'warning',
    text: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
  },
}

export function LoginPage() {
  const { login } = useAuth()
  const state = useLocation().state as LoginPageState | null
  const notice = state?.notice ? NOTICES[state.notice] : undefined
  const [serverError, setServerError] = useState<string | null>(null)
  const { field, handleSubmit, submitting } = useForm<LoginValues>(
    { email: state?.email ?? '', password: '' },
    validateLogin,
  )

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null)
    try {
      // Thành công: GuestOnly tự chuyển về trang định vào trước đó
      await login(email.trim(), password)
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  })

  return (
    <>
      <AuthHeading title="Đăng nhập" description="Chào mừng bạn quay lại ShopFast" />

      {serverError ? (
        <Alert variant="error" className="mt-6">
          {serverError}
        </Alert>
      ) : (
        notice && (
          <Alert variant={notice.variant} className="mt-6">
            {notice.text}
          </Alert>
        )
      )}

      <form noValidate onSubmit={onSubmit} className="mt-6 space-y-5">
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ban@email.com"
          autoFocus={!state?.email}
          {...field('email')}
        />
        <PasswordField
          label="Mật khẩu"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          autoFocus={Boolean(state?.email)}
          {...field('password')}
        />
        <Button
          type="submit"
          className="w-full"
          loading={submitting}
          loadingText="Đang đăng nhập…"
        >
          Đăng nhập
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Chưa có tài khoản?{' '}
        <Link
          to={PATHS.register}
          className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
        >
          Đăng ký ngay
        </Link>
      </p>
    </>
  )
}
