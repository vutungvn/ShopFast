import { LoaderCircle } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

/**
 * Hiện trong lúc khôi phục phiên đăng nhập, tránh trang đăng nhập loé lên rồi biến mất.
 * `fullScreen={false}` khi nằm trong layout đã có header.
 */
export function SplashScreen({ fullScreen = true }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-5',
        fullScreen ? 'min-h-dvh' : 'min-h-[50vh]',
      )}
    >
      {fullScreen && <Logo />}
      <LoaderCircle className="size-7 animate-spin text-brand-600" aria-hidden />
      <p className="text-sm text-slate-500">Đang tải phiên đăng nhập…</p>
    </div>
  )
}
