import { Check } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

const BENEFITS = [
  'Theo dõi trạng thái đơn hàng theo thời gian thực',
  'Hỗ trợ khách hàng cùng trợ lý AI',
  'Đặt hàng nhanh chỉ trong vài bước',
]

/** Cột thương hiệu bên trái màn đăng nhập/đăng ký; ẩn trên màn hình nhỏ. */
export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-600 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
      {/* Hoạ tiết trang trí */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-white/10" />
        <div className="absolute -right-40 -bottom-40 size-[28rem] rounded-full border border-white/15" />
        <div className="absolute -right-20 -bottom-20 size-72 rounded-full border border-dashed border-white/15" />
        <div className="absolute top-1/2 right-16 size-40 rotate-12 rounded-3xl border border-white/10" />
      </div>

      <div className="relative">
        <Logo tone="light" size="lg" />
        <p className="mt-6 max-w-lg text-xl leading-relaxed text-balance text-brand-50">
          Mua sắm nhanh chóng, theo dõi đơn hàng tức thì
        </p>
      </div>

      <ul className="relative space-y-5">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-center gap-4 text-lg">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Check className="size-5" strokeWidth={2.5} aria-hidden />
            </span>
            {benefit}
          </li>
        ))}
      </ul>

      <p className="relative inline-flex w-fit items-center gap-2.5 rounded-full bg-white/10 px-4 py-2 text-xs font-medium tracking-wider uppercase">
        <span className="size-1.5 rounded-full bg-white" aria-hidden />
        Nền tảng mua sắm thương mại điện tử thế hệ mới
      </p>
    </aside>
  )
}
