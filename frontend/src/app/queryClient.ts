import { QueryClient } from '@tanstack/react-query'
import { getErrorStatus } from '@/api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Lỗi 4xx (404, 400...) gửi lại cũng vậy; chỉ thử lại lỗi mạng / 5xx
      retry: (failureCount, error) => {
        const status = getErrorStatus(error)
        if (status !== undefined && status < 500) return false
        return failureCount < 2
      },
    },
  },
})
