import { ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/cn'

type LogoProps = {
  /** light: trên nền cam; dark: trên nền sáng */
  tone?: 'light' | 'dark'
  size?: 'md' | 'lg'
  className?: string
}

export function Logo({ tone = 'dark', size = 'md', className }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span
        className={cn(
          'flex items-center justify-center rounded-xl shadow-sm',
          size === 'lg' ? 'size-12' : 'size-10',
          tone === 'light' ? 'bg-white text-brand-600' : 'bg-brand-600 text-white',
        )}
      >
        <ShoppingBag className={size === 'lg' ? 'size-6' : 'size-5'} strokeWidth={2.25} aria-hidden />
      </span>
      <span
        className={cn(
          'font-bold tracking-tight',
          size === 'lg' ? 'text-3xl' : 'text-2xl',
          tone === 'light' ? 'text-white' : 'text-slate-900',
        )}
      >
        ShopFast
      </span>
    </div>
  )
}
