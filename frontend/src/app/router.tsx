import { createBrowserRouter, Navigate, Outlet, ScrollRestoration } from 'react-router'
import { ShopLayout } from '@/components/layout/ShopLayout'
import { AccountPage } from '@/features/account/pages/AccountPage'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { GuestOnly } from '@/features/auth/components/GuestOnly'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { CartPage } from '@/features/cart/pages/CartPage'
import { CatalogPage } from '@/features/catalog/pages/CatalogPage'
import { ProductDetailPage } from '@/features/catalog/pages/ProductDetailPage'
import { PATHS } from './paths'

export const router = createBrowserRouter([
  {
    // AuthProvider nằm trong router để các guard dùng được useLocation/Navigate
    element: (
      <AuthProvider>
        {/* Chuyển trang thì cuộn lên đầu; bấm Back thì về đúng vị trí cũ */}
        <ScrollRestoration />
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
        element: <ShopLayout />,
        children: [
          // Danh mục sản phẩm công khai: không cần đăng nhập
          { path: PATHS.home, element: <CatalogPage /> },
          { path: PATHS.product, element: <ProductDetailPage /> },
          {
            element: <RequireAuth />,
            children: [
              { path: PATHS.cart, element: <CartPage /> },
              { path: PATHS.account, element: <AccountPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to={PATHS.home} replace /> },
    ],
  },
])
