import { PackageX, ShoppingCart } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { getErrorMessage, getErrorStatus } from '@/api/errors'
import { PATHS } from '@/app/paths'
import { Alert } from '@/components/ui/Alert'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/button-styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { Toast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/auth-context'
import type { LoginPageState } from '@/features/auth/types'
import { MAX_QUANTITY_PER_ITEM } from '@/features/cart/constants'
import { useAddToCart, useCart } from '@/features/cart/queries'
import { formatPrice } from '@/lib/format'
import { findCategoryPath } from '../category-tree'
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard'
import { ProductImage } from '../components/ProductImage'
import { StockStatus } from '../components/StockStatus'
import { PERKS } from '../perks'
import { useCategoryTree, useProduct, useProducts } from '../queries'
import type { Product } from '../types'

export function ProductDetailPage() {
  const { slug = '' } = useParams()
  const product = useProduct(slug)

  if (product.isPending) return <DetailSkeleton />

  if (product.isError) {
    if (getErrorStatus(product.error) === 404) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <title>Không tìm thấy sản phẩm · ShopFast</title>
          <EmptyState
            icon={PackageX}
            title="Không tìm thấy sản phẩm"
            description="Sản phẩm không tồn tại hoặc đã ngừng bán."
            action={
              <Link to={PATHS.home} className={buttonClasses()}>
                Xem sản phẩm khác
              </Link>
            }
          />
        </div>
      )
    }
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <Alert variant="error">Không tải được sản phẩm. {getErrorMessage(product.error)}</Alert>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => product.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }

  // key: sang sản phẩm khác thì số lượng đã chọn trở về 1
  return <ProductDetail key={product.data.id} product={product.data} />
}

type Notice = { id: number; variant: 'success' | 'error'; message: string }

function ProductDetail({ product }: { product: Product }) {
  const categories = useCategoryTree()
  const { user } = useAuth()
  const cart = useCart()
  const addToCart = useAddToCart()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState<Notice | null>(null)

  const outOfStock = product.stock <= 0
  const isStaff = !!user && user.role !== 'CUSTOMER'
  // Trừ phần đã có trong giỏ: backend cộng dồn rồi mới so với tồn kho và giới hạn mỗi loại
  const inCart = cart.data?.items.find((item) => item.product.id === product.id)?.quantity ?? 0
  const remaining = Math.max(0, Math.min(product.stock, MAX_QUANTITY_PER_ITEM) - inCart)
  const maxQuantity = Math.max(1, remaining)
  const value = Math.min(quantity, maxQuantity)
  const canAdd = !outOfStock && remaining > 0
  const addLabel = outOfStock ? 'Hết hàng' : remaining === 0 ? 'Giỏ đã đủ số lượng tối đa' : 'Thêm vào giỏ hàng'

  const handleAdd = () => {
    if (!user) {
      // Đăng nhập xong quay lại đúng sản phẩm này
      const state: LoginPageState = { from: location.pathname + location.search }
      navigate(PATHS.login, { state })
      return
    }
    addToCart.mutate(
      { productId: product.id, quantity: value },
      {
        onSuccess: () => {
          setNotice({ id: Date.now(), variant: 'success', message: `${product.name} × ${value}` })
          setQuantity(1)
        },
        onError: (error) => {
          setNotice({ id: Date.now(), variant: 'error', message: getErrorMessage(error) })
          // Hết hàng / ngừng bán / kho đổi: tải lại để hiện tồn kho mới
          const status = getErrorStatus(error)
          if (status === 404 || status === 409) {
            void queryClient.invalidateQueries({ queryKey: ['product', product.slug] })
          }
        },
      },
    )
  }

  const categoryPath = categories.data
    ? findCategoryPath(categories.data, (n) => n.id === product.category.id)
    : [product.category]

  return (
    <>
      <title>{`${product.name} · ShopFast`}</title>

      <Breadcrumb
        items={[
          { label: 'Trang chủ', to: PATHS.home },
          ...categoryPath.map((node) => ({ label: node.name, to: `${PATHS.home}?category=${node.slug}` })),
          { label: product.name },
        ]}
      />

      <section className="mt-5 grid gap-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        <ProductImage categorySlug={product.category.slug} size="detail" />

        <div className="flex flex-col">
          <Link
            to={`${PATHS.home}?brand=${product.brand.slug}`}
            className="text-sm font-semibold tracking-wider text-brand-600 uppercase hover:text-brand-700"
          >
            {product.brand.name}
          </Link>
          <h1 className="mt-2 text-2xl leading-tight font-bold tracking-tight text-slate-900 sm:text-3xl">
            {product.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            SKU: <span className="font-medium text-slate-700">{product.sku}</span>
            <span className="mx-2 text-slate-300">·</span>
            Danh mục:{' '}
            <Link
              to={`${PATHS.home}?category=${product.category.slug}`}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              {product.category.name}
            </Link>
          </p>

          <p className="mt-5 text-3xl font-bold text-brand-600 sm:text-4xl">{formatPrice(product.price)}</p>
          <div className="mt-3">
            <StockStatus stock={product.stock} variant="pill" />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="text-sm font-medium text-slate-700">Số lượng</p>
            <div className="mt-2 flex items-center gap-3">
              <QuantityStepper
                value={value}
                max={maxQuantity}
                onChange={setQuantity}
                disabled={!canAdd || isStaff}
              />
              {canAdd && !isStaff && (
                <span className="text-sm text-slate-500">
                  Tối đa {remaining} sản phẩm
                  {inCart > 0 && <span className="text-slate-400"> · Giỏ đã có {inCart}</span>}
                </span>
              )}
            </div>

            {/* Mobile dùng thanh dính đáy bên dưới */}
            <div className="mt-5 hidden lg:block">
              {isStaff ? (
                <Alert variant="warning">Tài khoản nhân viên không thể mua hàng.</Alert>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!canAdd}
                  loading={addToCart.isPending}
                  loadingText="Đang thêm..."
                  onClick={handleAdd}
                >
                  <ShoppingCart className="size-5" aria-hidden />
                  {addLabel}
                </Button>
              )}
            </div>
          </div>

          <ul className="mt-6 space-y-2.5 rounded-xl bg-slate-50 p-4">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-600">
                <Icon className="size-4.5 shrink-0 text-brand-600" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Mô tả sản phẩm</h2>
        <p className="mt-3 leading-relaxed whitespace-pre-line text-slate-600">
          {product.description || 'Chưa có mô tả cho sản phẩm này.'}
        </p>
      </section>

      <RelatedProducts product={product} />

      {/* Mobile: thanh mua hàng dính đáy màn hình */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">Giá bán</p>
          <p className="truncate text-lg font-bold text-brand-600">{formatPrice(product.price)}</p>
        </div>
        {isStaff ? (
          <p className="ml-auto text-right text-sm text-slate-500">Tài khoản nhân viên không thể mua hàng</p>
        ) : (
          <Button
            className="ml-auto"
            disabled={!canAdd}
            loading={addToCart.isPending}
            loadingText="Đang thêm..."
            onClick={handleAdd}
          >
            <ShoppingCart className="size-5" aria-hidden />
            {outOfStock ? 'Hết hàng' : remaining === 0 ? 'Đã đủ tối đa' : 'Thêm vào giỏ'}
          </Button>
        )}
      </div>
      <div className="h-20 lg:hidden" aria-hidden />

      {notice && (
        <Toast
          key={notice.id}
          variant={notice.variant}
          title={notice.variant === 'success' ? 'Đã thêm vào giỏ hàng' : 'Không thêm được vào giỏ'}
          onClose={() => setNotice(null)}
        >
          <p className="truncate">{notice.message}</p>
          {notice.variant === 'success' && (
            <Link to={PATHS.cart} className={buttonClasses('primary', 'sm', 'mt-3')}>
              Xem giỏ hàng
            </Link>
          )}
        </Toast>
      )}
    </>
  )
}

function RelatedProducts({ product }: { product: Product }) {
  // Lấy dư 1 để vẫn đủ 4 sau khi bỏ chính sản phẩm đang xem
  const related = useProducts({ category: product.category.slug, limit: 5 })
  const items = related.data?.items.filter((p) => p.id !== product.id).slice(0, 4) ?? []

  if (!related.isPending && items.length === 0) return null

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Sản phẩm cùng danh mục</h2>
        <Link
          to={`${PATHS.home}?category=${product.category.slug}`}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Xem tất cả
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {related.isPending
          ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)
          : items.map((item) => <ProductCard key={item.id} product={item} />)}
      </div>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Đang tải sản phẩm">
      <div className="h-4 w-64 rounded bg-slate-200" />
      <div className="mt-5 grid gap-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 lg:grid-cols-[5fr_6fr] lg:gap-12">
        <div className="aspect-square rounded-xl bg-slate-100" />
        <div className="space-y-4">
          <div className="h-4 w-20 rounded bg-slate-200" />
          <div className="h-8 w-3/4 rounded bg-slate-200" />
          <div className="h-4 w-1/2 rounded bg-slate-200" />
          <div className="h-10 w-48 rounded bg-slate-200" />
          <div className="h-12 w-full rounded-lg bg-slate-200" />
        </div>
      </div>
    </div>
  )
}
