import { createBrowserRouter, Navigate, Outlet, ScrollRestoration } from 'react-router'
import { ShopLayout } from '@/components/layout/ShopLayout'
import { StaffLayout } from '@/components/layout/StaffLayout'
import { AccountPage } from '@/features/account/pages/AccountPage'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { GuestOnly } from '@/features/auth/components/GuestOnly'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { RequireRole } from '@/features/auth/components/RequireRole'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { STAFF_ROLES } from '@/features/auth/roles'
import { CartPage } from '@/features/cart/pages/CartPage'
import { CatalogPage } from '@/features/catalog/pages/CatalogPage'
import { ProductDetailPage } from '@/features/catalog/pages/ProductDetailPage'
import { CheckoutPage } from '@/features/orders/pages/CheckoutPage'
import { OrderDetailPage } from '@/features/orders/pages/OrderDetailPage'
import { OrdersPage } from '@/features/orders/pages/OrdersPage'
import { PaymentPage } from '@/features/orders/pages/PaymentPage'
import { InventoryPage } from '@/features/staff/pages/InventoryPage'
import { StaffOrderDetailPage } from '@/features/staff/pages/StaffOrderDetailPage'
import { StaffOrdersPage } from '@/features/staff/pages/StaffOrdersPage'
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
              {
                // Mua hàng: chỉ khách hàng
                element: <RequireRole roles={['CUSTOMER']} />,
                children: [
                  { path: PATHS.checkout, element: <CheckoutPage /> },
                  { path: PATHS.orders, element: <OrdersPage /> },
                  { path: PATHS.order, element: <OrderDetailPage /> },
                  { path: PATHS.orderPayment, element: <PaymentPage /> },
                ],
              },
            ],
          },
        ],
      },
      {
        // Khu nhân viên: CSKH chỉ xem đơn; kho và admin xử lý đơn, quản lý tồn kho
        element: <RequireAuth />,
        children: [
          {
            element: <RequireRole roles={STAFF_ROLES} />,
            children: [
              {
                element: <StaffLayout />,
                children: [
                  { path: PATHS.staffOrders, element: <StaffOrdersPage /> },
                  { path: PATHS.staffOrder, element: <StaffOrderDetailPage /> },
                  {
                    element: <RequireRole roles={['WAREHOUSE', 'ADMIN']} />,
                    children: [{ path: PATHS.staffInventory, element: <InventoryPage /> }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to={PATHS.home} replace /> },
    ],
  },
])
