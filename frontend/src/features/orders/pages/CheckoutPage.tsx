import axios from 'axios'
import { ArrowLeft, ArrowRight, PencilLine, ShoppingCart, TriangleAlert, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { getErrorMessage } from '@/api/errors'
import { orderPaymentPath, PATHS } from '@/app/paths'
import { Alert } from '@/components/ui/Alert'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/auth-context'
import type { User } from '@/features/auth/types'
import { useCart } from '@/features/cart/queries'
import type { Cart, CartItem } from '@/features/cart/types'
import { ProductImage } from '@/features/catalog/components/ProductImage'
import { PERKS } from '@/features/catalog/perks'
import { useForm } from '@/hooks/useForm'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import { CheckoutSteps } from '../components/CheckoutSteps'
import { OrderTotals } from '../components/OrderTotals'
import { usePlaceOrder } from '../queries'
import type { CheckoutProblem, ShippingInfo } from '../types'
import { MAX_ADDRESS, validateShipping } from '../validation'

const FORM_ID = 'checkout-form'

export function CheckoutPage() {
  const { user } = useAuth()
  const cart = useCart()

  return (
    <>
      <title>Thanh toán · ShopFast</title>
      <Breadcrumb
        items={[
          { label: 'Trang chủ', to: PATHS.home },
          { label: 'Giỏ hàng', to: PATHS.cart },
          { label: 'Thanh toán' },
        ]}
      />
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-6">
        <CheckoutSteps current={2} />
      </div>

      {cart.isPending ? (
        <div className="mt-6 h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-label="Đang tải" />
      ) : cart.isError ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <Alert variant="error">Không tải được giỏ hàng. {getErrorMessage(cart.error)}</Alert>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => cart.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : cart.data.items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
          <EmptyState
            icon={ShoppingCart}
            title="Giỏ hàng đang trống"
            description="Thêm sản phẩm vào giỏ trước khi đặt hàng nhé."
            action={
              <Link to={PATHS.home} className={buttonClasses()}>
                Khám phá sản phẩm
              </Link>
            }
          />
        </div>
      ) : (
        user && <CheckoutForm user={user} cart={cart.data} />
      )}
    </>
  )
}

/** Body lỗi 409 khi đặt đơn có `items`: các dòng không đủ hàng / ngừng bán */
function checkoutProblems(error: unknown): CheckoutProblem[] | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null
  const items: unknown = error.response.data?.items
  return Array.isArray(items) ? (items as CheckoutProblem[]) : null
}

function CheckoutForm({ user, cart }: { user: User; cart: Cart }) {
  const navigate = useNavigate()
  const placeOrder = usePlaceOrder()
  const [problems, setProblems] = useState<CheckoutProblem[] | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const { field, handleSubmit, submitting } = useForm<ShippingInfo>(
    { recipientName: user.fullName, recipientPhone: user.phone ?? '', shippingAddress: '' },
    validateShipping,
  )

  const onSubmit = handleSubmit(async (values) => {
    setProblems(null)
    setServerError(null)
    try {
      const order = await placeOrder.mutateAsync({
        recipientName: values.recipientName.trim(),
        recipientPhone: values.recipientPhone.trim(),
        shippingAddress: values.shippingAddress.trim(),
      })
      // replace: bấm Back từ trang thanh toán không quay lại form đặt đơn của giỏ đã đặt
      navigate(orderPaymentPath(order.id), { replace: true })
    } catch (error) {
      const items = checkoutProblems(error)
      if (items) setProblems(items)
      else setServerError(getErrorMessage(error))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  })

  const problemOf = (item: CartItem) => problems?.find((p) => p.productId === item.product.id)

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="min-w-0 space-y-6">
        {problems && (
          <div role="alert" className="flex gap-4 rounded-2xl border border-red-200 bg-red-50 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600">
              <TriangleAlert className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-red-800">Không thể đặt hàng</p>
              <p className="mt-1 text-sm text-red-700">
                Một số sản phẩm không đủ hàng. Vui lòng cập nhật giỏ hàng rồi đặt lại.
              </p>
              <Link
                to={PATHS.cart}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Quay lại giỏ hàng để cập nhật
              </Link>
            </div>
          </div>
        )}
        {serverError && <Alert variant="error">{serverError}</Alert>}

        <form
          id={FORM_ID}
          noValidate
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Truck className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Thông tin nhận hàng</h2>
              <p className="text-sm text-slate-500">Kiểm tra kỹ địa chỉ để nhận hàng nhanh nhất</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField label="Họ tên người nhận" required autoComplete="name" maxLength={100} {...field('recipientName')} />
            <TextField
              label="Số điện thoại"
              hint="VD: 0912345678"
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              {...field('recipientPhone')}
            />
          </div>
          <TextAreaField
            className="mt-4"
            label="Địa chỉ nhận hàng"
            required
            autoComplete="street-address"
            placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
            maxLength={MAX_ADDRESS}
            {...field('shippingAddress')}
          />
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              Sản phẩm
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {cart.itemCount} loại
              </span>
            </h2>
            <Link
              to={PATHS.cart}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Sửa giỏ hàng
              <PencilLine className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {cart.items.map((item) => {
              const problem = problemOf(item)
              const unavailable = problem && problem.issue !== 'INSUFFICIENT_STOCK'
              return (
                <li
                  key={item.product.id}
                  className={cn(
                    'relative flex items-center gap-4 py-4',
                    problem?.issue === 'INSUFFICIENT_STOCK' && '-mx-3 rounded-xl bg-amber-50/70 px-3',
                    unavailable && '-mx-3 rounded-xl bg-slate-50 px-3',
                  )}
                >
                  {problem?.issue === 'INSUFFICIENT_STOCK' && (
                    <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-amber-400" aria-hidden />
                  )}
                  <ProductImage
                    categorySlug={item.product.category.slug}
                    src={item.product.imageUrl}
                    size="thumb"
                    className={cn('size-16 shrink-0', unavailable && 'opacity-60')}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={cn('font-medium', unavailable ? 'text-slate-500' : 'text-slate-900')}>
                        {item.product.name}
                      </span>
                      {problem && (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            unavailable ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-800',
                          )}
                        >
                          {problem.issue === 'INACTIVE'
                            ? 'Ngừng bán'
                            : problem.issue === 'OUT_OF_STOCK'
                              ? 'Hết hàng'
                              : `Chỉ còn ${problem.stock}`}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      SKU: {item.product.sku} · Đơn giá {formatPrice(item.product.price)}
                    </p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-600">x{item.quantity}</span>
                  <span
                    className={cn(
                      'w-32 text-right font-semibold',
                      unavailable ? 'text-slate-400 line-through' : 'text-slate-900',
                    )}
                  >
                    {formatPrice(item.lineTotal)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Đơn hàng</h2>
          <OrderTotals
            className="mt-4 border-t border-slate-100 pt-4"
            subtotal={cart.subtotal}
            shippingFee={0}
            totalAmount={cart.subtotal}
            quantity={cart.totalQuantity}
          />
          <Button
            type="submit"
            form={FORM_ID}
            size="lg"
            className="mt-6 hidden w-full lg:flex"
            loading={submitting}
            loadingText="Đang đặt hàng..."
          >
            Đặt hàng
            <ArrowRight className="size-5" aria-hidden />
          </Button>
          <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
            Bạn có 24 giờ để thanh toán sau khi đặt. Quá hạn đơn sẽ tự huỷ và hàng được trả lại kho.
          </p>
          <ul className="mt-5 space-y-2.5 rounded-xl bg-slate-50 p-4">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-600">
                <Icon className="size-4.5 shrink-0 text-brand-600" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </section>
      </aside>

      {/* Mobile: thanh đặt hàng dính đáy màn hình */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">Tổng cộng</p>
          <p className="truncate text-lg font-bold text-brand-600">{formatPrice(cart.subtotal)}</p>
        </div>
        <Button type="submit" form={FORM_ID} className="ml-auto" loading={submitting} loadingText="Đang đặt...">
          Đặt hàng
        </Button>
      </div>
      <div className="h-16 lg:hidden" aria-hidden />
    </div>
  )
}
