import { ArrowLeft, ShieldAlert, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { getErrorMessage } from '@/api/errors'
import { PATHS } from '@/app/paths'
import { Alert } from '@/components/ui/Alert'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPrice } from '@/lib/format'
import { CartItemRow } from '../components/CartItemRow'
import { CartSummary, CheckoutButton } from '../components/CartSummary'
import { ClearCartDialog } from '../components/ClearCartDialog'
import { EmptyCart } from '../components/EmptyCart'
import {
  useCanUseCart,
  useCart,
  useClearCart,
  usePendingCartProductIds,
  useRemoveCartItem,
  useUpdateCartItem,
} from '../queries'
import type { Cart } from '../types'

export function CartPage() {
  const canUseCart = useCanUseCart()

  return (
    <>
      <title>Giỏ hàng · ShopFast</title>
      <Breadcrumb items={[{ label: 'Trang chủ', to: PATHS.home }, { label: 'Giỏ hàng' }]} />
      {canUseCart ? (
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
  const cart = useCart()

  if (cart.isPending) return <CartSkeleton />

  if (cart.isError) {
    return (
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
        <Alert variant="error">Không tải được giỏ hàng. {getErrorMessage(cart.error)}</Alert>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => cart.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }

  return <CartContent cart={cart.data} />
}

function CartContent({ cart }: { cart: Cart }) {
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()
  const clearCart = useClearCart()
  const pendingIds = usePendingCartProductIds()
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const isEmpty = cart.items.length === 0

  // mutateAsync thay cho callback của mutate: callback chỉ chạy cho lần gọi cuối, còn ở đây nhiều dòng có thể cùng lưu
  const run = (action: Promise<unknown>) => {
    setError(null)
    action.catch((e: unknown) => setError(getErrorMessage(e)))
  }

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
              {error && (
                <Alert variant="error" className="mb-4">
                  {error}
                </Alert>
              )}
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {cart.items.map((item) => {
                  const productId = item.product.id
                  return (
                    <CartItemRow
                      key={productId}
                      item={item}
                      pending={pendingIds.includes(productId)}
                      onQuantityChange={(quantity) =>
                        quantity !== item.quantity && run(updateItem.mutateAsync({ productId, quantity }))
                      }
                      onRemove={() => run(removeItem.mutateAsync({ productId }))}
                    />
                  )
                })}
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
        loading={clearCart.isPending}
        error={clearCart.error ? getErrorMessage(clearCart.error) : null}
        onClose={() => {
          setConfirmClear(false)
          clearCart.reset()
        }}
        onConfirm={() => clearCart.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}
      />
    </>
  )
}

function CartSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Đang tải giỏ hàng">
      <div className="mt-2 h-8 w-64 rounded bg-slate-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex gap-4 p-4 sm:p-5">
              <div className="size-18 shrink-0 rounded-xl bg-slate-100 sm:size-24" />
              <div className="flex-1 space-y-2.5 py-1">
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="h-3 w-40 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-72 rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  )
}
