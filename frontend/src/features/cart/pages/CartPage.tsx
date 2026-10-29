import { ArrowLeft, ShieldAlert, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { PATHS } from '@/app/paths'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/features/auth/auth-context'
import { formatPrice } from '@/lib/format'
import { CartItemRow } from '../components/CartItemRow'
import { CartSummary, CheckoutButton } from '../components/CartSummary'
import { ClearCartDialog } from '../components/ClearCartDialog'
import { EmptyCart } from '../components/EmptyCart'
import { useMockCart } from '../mock-cart'

export function CartPage() {
  const { user } = useAuth()

  return (
    <>
      <title>Giỏ hàng · ShopFast</title>
      <Breadcrumb items={[{ label: 'Trang chủ', to: PATHS.home }, { label: 'Giỏ hàng' }]} />
      {/* Backend chỉ cho khách hàng dùng giỏ (nhân viên nhận 403) */}
      {user?.role === 'CUSTOMER' ? (
        <CustomerCart />
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
          <EmptyState
            icon={ShieldAlert}
            title="Giỏ hàng chỉ dành cho khách hàng"
            description="Tài khoản nhân viên không thể mua hàng. Vui lòng đăng nhập bằng tài khoản khách hàng."
            action={
              <Link to={PATHS.home} className={buttonClasses('outline')}>
                Về trang chủ
              </Link>
            }
          />
        </div>
      )}
    </>
  )
}

function CustomerCart() {
  const { cart, updateQuantity, removeItem, clear } = useMockCart()
  const [confirmClear, setConfirmClear] = useState(false)
  const isEmpty = cart.items.length === 0

  return (
    <>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Giỏ hàng của bạn
          {!isEmpty && <span className="ml-2 text-base font-normal text-slate-500">({cart.itemCount} sản phẩm)</span>}
        </h1>
        {!isEmpty && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
            <Trash2 className="size-4" aria-hidden />
            Xoá tất cả
          </Button>
        )}
      </div>

      <div className="mt-6">
        {isEmpty ? (
          <EmptyCart />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0">
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {cart.items.map((item) => (
                  <CartItemRow
                    key={item.product.id}
                    item={item}
                    onQuantityChange={(quantity) => updateQuantity(item.product.id, quantity)}
                    onRemove={() => removeItem(item.product.id)}
                  />
                ))}
              </ul>
              <Link
                to={PATHS.home}
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Tiếp tục mua sắm
              </Link>
            </div>

            <div className="lg:sticky lg:top-24">
              <CartSummary cart={cart} />
            </div>
          </div>
        )}
      </div>

      {!isEmpty && (
        <>
          {/* Mobile: thanh đặt hàng dính đáy màn hình */}
          <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Tổng cộng</p>
              <p className="truncate text-lg font-bold text-brand-600">{formatPrice(cart.subtotal)}</p>
            </div>
            <CheckoutButton cart={cart} className="ml-auto" />
          </div>
          <div className="h-20 lg:hidden" aria-hidden />
        </>
      )}

      <ClearCartDialog
        open={confirmClear}
        itemCount={cart.itemCount}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          clear()
          setConfirmClear(false)
        }}
      />
    </>
  )
}
