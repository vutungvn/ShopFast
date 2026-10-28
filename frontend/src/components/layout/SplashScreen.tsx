import { LoaderCircle } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

/** Hiện trong lúc khôi phục phiên đăng nhập, tránh trang đăng nhập loé lên rồi biến mất. */
export function SplashScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5" role="status">
      <Logo />
      <LoaderCircle className="size-7 animate-spin text-brand-600" aria-hidden />
      <p className="text-sm text-slate-500">Đang tải phiên đăng nhập…</p>
    </div>
  )
}
