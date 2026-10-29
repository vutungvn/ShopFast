import { Lock } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PERKS } from '@/features/catalog/perks'
import { formatPrice } from '@/lib/format'
import type { Cart } from '../types'

/** Tóm tắt giỏ hàng (cột phải). Trên mobile nút đặt hàng nằm ở thanh dính đáy nên ẩn ở đây. */
export function CartSummary({ cart }: { cart: Cart }) {
  const issueCount = cart.items.filter((item) => item.issue).length

  return (
    <section aria-labelledby="cart-summary-title" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 id="cart-summary-title" className="text-lg font-semibold text-slate-900">
        Tóm tắt đơn hàng
      </h2>

      <dl className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">Tạm tính ({cart.totalQuantity} sản phẩm)</dt>
          <dd className="font-medium text-slate-900">{formatPrice(cart.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">Phí vận chuyển</dt>
          <dd className="text-slate-500">Tính ở bước đặt hàng</dd>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
          <dt className="font-semibold text-slate-900">Tổng cộng</dt>
          <dd className="text-2xl font-bold text-brand-600">{formatPrice(cart.subtotal)}</dd>
        </div>
      </dl>

      {issueCount > 0 && (
        <Alert variant="warning" className="mt-5">
          Có {issueCount} sản phẩm cần điều chỉnh hoặc xoá trước khi đặt hàng.
        </Alert>
      )}

      <div className="mt-5 hidden lg:block">
        <CheckoutButton cart={cart} className="w-full" size="lg" />
        {cart.canCheckout && <p className="mt-2 text-center text-xs text-slate-400">Tính năng đặt hàng sắp ra mắt</p>}
      </div>

      <ul className="mt-5 space-y-2.5 rounded-xl bg-slate-50 p-4">
        {PERKS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-sm text-slate-600">
            <Icon className="size-4.5 shrink-0 text-brand-600" aria-hidden />
            {text}
          </li>
        ))}
      </ul>
    </section>
  )
}

type CheckoutButtonProps = {
  cart: Cart
  className?: string
  size?: 'md' | 'lg'
}

/** Đặt hàng làm ở bước sau: tạm khoá nút. Giỏ còn dòng lỗi thì hiện khoá để báo chưa đặt được. */
export function CheckoutButton({ cart, className, size = 'md' }: CheckoutButtonProps) {
  return (
    <Button
      size={size}
      className={className}
      disabled
      title={cart.canCheckout ? 'Tính năng đặt hàng sắp ra mắt' : 'Vui lòng xử lý các sản phẩm có vấn đề trước'}
    >
      {!cart.canCheckout && <Lock className="size-4.5" aria-hidden />}
      Tiến hành đặt hàng
    </Button>
  )
}
