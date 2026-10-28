import { createBrowserRouter, Navigate, Outlet } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { AccountPage } from '@/features/account/pages/AccountPage'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { GuestOnly } from '@/features/auth/components/GuestOnly'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { PATHS } from './paths'

export const router = createBrowserRouter([
  {
    // AuthProvider nằm trong router để các guard dùng được useLocation/Navigate
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      {
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: PATHS.login, element: <LoginPage /> },
              { path: PATHS.register, element: <RegisterPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [{ path: PATHS.home, element: <AccountPage /> }],
          },
        ],
      },
      { path: '*', element: <Navigate to={PATHS.home} replace /> },
    ],
  },
])
