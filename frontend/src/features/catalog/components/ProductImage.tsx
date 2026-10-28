import {
  AirVent,
  CookingPot,
  Footprints,
  Headphones,
  Laptop,
  Microwave,
  Package,
  Shirt,
  Smartphone,
  Tablet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// Sản phẩm chưa có ảnh (chưa có trường imageUrl): hiện icon theo danh mục
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'dien-thoai': Smartphone,
  laptop: Laptop,
  'may-tinh-bang': Tablet,
  'tai-nghe': Headphones,
  'noi-com-dien': CookingPot,
  'noi-chien-khong-dau': Microwave,
  'may-loc-khong-khi': AirVent,
  'giay-the-thao': Footprints,
  'ao-thun': Shirt,
}

type ProductImageProps = {
  categorySlug: string
  size?: 'card' | 'detail'
  className?: string
}

export function ProductImage({ categorySlug, size = 'card', className }: ProductImageProps) {
  const Icon = CATEGORY_ICONS[categorySlug] ?? Package
  return (
    <div
      className={cn(
        'flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100',
        className,
      )}
    >
      <Icon
        className={cn('text-slate-300', size === 'detail' ? 'size-32' : 'size-14')}
        strokeWidth={1.25}
        aria-hidden
      />
    </div>
  )
}
