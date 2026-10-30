import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inventoryApi, type ManageProductQuery } from './api'

const INVENTORY_KEY = ['inventory'] as const

export function useManageProducts(query: ManageProductQuery) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'list', query],
    queryFn: () => inventoryApi.list(query),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useInventoryStats() {
  return useQuery({ queryKey: [...INVENTORY_KEY, 'stats'], queryFn: inventoryApi.stats, staleTime: 0 })
}

export function useUpdateInventory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, change }: { productId: string; change: { stock: number } | { delta: number } }) =>
      inventoryApi.update(productId, change),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
      // Trang sản phẩm của khách hiện tồn kho: làm mới luôn
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['product'] })
    },
  })
}
