import { createBrowserRouter, Navigate } from 'react-router'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { PATHS } from './paths'

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: PATHS.login, element: <LoginPage /> },
      { path: PATHS.register, element: <RegisterPage /> },
    ],
  },
  // Chưa có trang chủ: tạm đưa mọi đường dẫn khác về trang đăng nhập
  { path: '*', element: <Navigate to={PATHS.login} replace /> },
])
