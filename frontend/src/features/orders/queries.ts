import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { CART_QUERY_KEY } from '@/features/cart/queries'
import { ordersApi } from './api'
import type { OrderStatus, ShippingInfo, StaffOrderQuery } from './types'

export const ORDERS_QUERY_KEY = ['orders'] as const

/** Đơn là dữ liệu riêng của người đăng nhập: đưa id vào key để đổi tài khoản không thấy dữ liệu cũ */
function useOrdersKey() {
  const { user } = useAuth()
  return [...ORDERS_QUERY_KEY, user?.id] as const
}

/** GET /orders/me */
export function useMyOrders(status: readonly OrderStatus[], page: number, limit: number) {
  const key = useOrdersKey()
  return useQuery({
    queryKey: [...key, 'mine', { status, page, limit }],
    queryFn: () => ordersApi.mine({ status, page, limit }),
    // Đổi tab / trang: giữ danh sách cũ trong lúc tải, không nháy về skeleton
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

/** GET /orders/:id */
export function useOrderDetail(orderId: string) {
  const key = useOrdersKey()
  return useQuery({
    queryKey: [...key, 'detail', orderId],
    queryFn: () => ordersApi.detail(orderId),
    // Trạng thái đơn đổi theo thao tác của người khác (kho, hệ thống): vào lại trang thì tải mới
    staleTime: 0,
  })
}

/** GET /orders (nhân viên) */
export function useStaffOrders(query: StaffOrderQuery) {
  const key = useOrdersKey()
  return useQuery({
    queryKey: [...key, 'staff', query],
    queryFn: () => ordersApi.staffList(query),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

/** GET /orders/stats */
export function useOrderStats() {
  const key = useOrdersKey()
  return useQuery({ queryKey: [...key, 'stats'], queryFn: ordersApi.stats, staleTime: 0 })
}

/** Mọi thao tác trên đơn: xong (thành công hay lỗi 409 vì đơn đã đổi) thì tải lại các danh sách / chi tiết đơn */
function useOrderMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY }),
  })
}

export function usePlaceOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (shipping: ShippingInfo) => ordersApi.place(shipping),
    onSettled: () => {
      // Đặt xong backend xoá giỏ; lỗi thiếu hàng thì giỏ cần tải lại để hiện tồn kho mới
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY })
    },
  })
}

export const usePayOrder = () => useOrderMutation((orderId: string) => ordersApi.pay(orderId))

export const useCancelOrder = () =>
  useOrderMutation(({ orderId, reason }: { orderId: string; reason: string }) => ordersApi.cancel(orderId, reason))

export const useAdvanceOrder = () =>
  useOrderMutation(({ orderId, status, note }: { orderId: string; status: OrderStatus; note: string }) =>
    ordersApi.advance(orderId, status, note),
  )
