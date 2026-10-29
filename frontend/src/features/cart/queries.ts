import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { cartApi } from './api'
import type { Cart } from './types'

export const CART_QUERY_KEY = ['cart'] as const
const CART_MUTATION_KEY = ['cart-mutation']

/** Giỏ thuộc về người đăng nhập: đưa id vào key để đổi tài khoản không thấy giỏ của người trước */
const cartKey = (userId: string | undefined) => [...CART_QUERY_KEY, userId] as const

/** Chỉ khách hàng có giỏ (backend trả 403 cho nhân viên) */
export function useCanUseCart() {
  const { user } = useAuth()
  return user?.role === 'CUSTOMER'
}

export function useCart() {
  const { user } = useAuth()
  return useQuery({
    queryKey: cartKey(user?.id),
    queryFn: cartApi.get,
    enabled: user?.role === 'CUSTOMER',
    // Giá và tồn kho trong giỏ là giá trị hiện tại: vào lại trang thì tải mới
    staleTime: 0,
  })
}

type CartLine = { productId: string; quantity: number }

function useCartMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<Cart>) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = cartKey(user?.id)

  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    // Chạy lần lượt: response về đúng thứ tự nên giỏ trong cache luôn là bản mới nhất
    scope: { id: 'cart' },
    mutationFn,
    onSuccess: (cart) => queryClient.setQueryData(queryKey, cart),
    // Giỏ trên server đã khác (hết hàng, bị xoá ở tab khác...): tải lại để hiện đúng
    onError: () => queryClient.invalidateQueries({ queryKey }),
  })
}

export const useAddToCart = () =>
  useCartMutation(({ productId, quantity }: CartLine) => cartApi.addItem(productId, quantity))

export const useUpdateCartItem = () =>
  useCartMutation(({ productId, quantity }: CartLine) => cartApi.updateItem(productId, quantity))

export const useRemoveCartItem = () =>
  useCartMutation(({ productId }: { productId: string }) => cartApi.removeItem(productId))

export const useClearCart = () => useCartMutation(() => cartApi.clear())

/** productId của các dòng đang chờ lưu (gồm cả thao tác đang xếp hàng) */
export function usePendingCartProductIds() {
  return useMutationState({
    filters: { mutationKey: CART_MUTATION_KEY, status: 'pending' },
    select: (mutation) => (mutation.state.variables as Partial<CartLine> | undefined)?.productId,
  })
}
