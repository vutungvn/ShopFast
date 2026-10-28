import { Outlet } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { BrandPanel } from './BrandPanel'

/** Khung chung của màn đăng nhập/đăng ký: cột thương hiệu + card chứa form. */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <BrandPanel />
      <main className="flex items-center justify-center px-4 py-10 sm:px-6 lg:py-12">
        <div className="w-full max-w-md">
          <Logo className="mb-8 justify-center lg:hidden" />
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
