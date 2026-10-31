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
import { useState } from 'react'
import { cn } from '@/lib/cn'

// Sản phẩm chưa có ảnh, hoặc ảnh tải lỗi: hiện icon theo danh mục
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

const ICON_SIZES = {
  thumb: 'size-8 sm:size-10',
  card: 'size-14',
  detail: 'size-32',
}

type ProductImageProps = {
  /** Dùng chọn icon khi không có ảnh; không rõ danh mục (vd dòng đơn) thì truyền '' => icon chung */
  categorySlug: string
  src?: string | null
  /** Để trống khi tên sản phẩm đã hiện ngay cạnh ảnh (ảnh chỉ để trang trí) */
  alt?: string
  size?: 'thumb' | 'card' | 'detail'
  className?: string
}

export function ProductImage({ categorySlug, src, alt = '', size = 'card', className }: ProductImageProps) {
  // Nhớ ảnh nào đã lỗi; đổi sang ảnh khác (src khác) thì thử lại
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const Icon = CATEGORY_ICONS[categorySlug] ?? Package
  const showImage = Boolean(src) && src !== failedSrc

  return (
    <div
      className={cn(
        'flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100',
        className,
      )}
    >
      {showImage ? (
        <img
          src={src!}
          alt={alt}
          width={800}
          height={800}
          // Ảnh lớn ở trang chi tiết nằm ngay đầu trang: tải luôn; còn lại chỉ tải khi cuộn tới
          loading={size === 'detail' ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailedSrc(src!)}
          className="size-full object-cover"
        />
      ) : (
        <Icon className={cn('text-slate-300', ICON_SIZES[size])} strokeWidth={1.25} aria-hidden />
      )}
    </div>
  )
}
