import axios, { type AxiosError } from 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Không tự refresh khi gặp 401 (các endpoint /auth/*: 401 ở đó là sai thông tin, không phải hết hạn) */
    skipAuthRefresh?: boolean
    /** Đã gửi lại một lần sau refresh: không lặp vô hạn */
    retried?: boolean
  }
}

export const http = axios.create({ baseURL: '/api/v1', timeout: 15_000 })

// Access token chỉ nằm trong bộ nhớ (không localStorage) để script độc hại không đọc được.
// Tải lại trang thì mất, AuthProvider dùng cookie refresh để lấy lại.
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

let onSessionExpired: (() => void) | null = null

/** AuthProvider đăng ký để chuyển về trạng thái chưa đăng nhập khi không refresh được. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler
}

let refreshPromise: Promise<string> | null = null

/**
 * Lấy access token mới bằng cookie refresh. Các lời gọi đồng thời dùng chung MỘT request:
 * backend coi 2 request refresh cùng một cookie là "dùng lại token" và thu hồi cả phiên
 * (vd StrictMode chạy effect 2 lần, hoặc nhiều request cùng gặp 401).
 */
export function refreshAccessToken(): Promise<string> {
  refreshPromise ??= http
    .post<{ accessToken: string }>('/auth/refresh', undefined, { skipAuthRefresh: true })
    .then(({ data }) => {
      accessToken = data.accessToken
      return data.accessToken
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

http.interceptors.request.use((config) => {
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

http.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config
  const usedToken = config?.headers.Authorization
  if (
    error.response?.status !== 401 ||
    !config ||
    !usedToken ||
    config.skipAuthRefresh ||
    config.retried
  ) {
    throw error
  }
  config.retried = true

  // Request gửi bằng token cũ, trong lúc đó request khác đã refresh xong: chỉ cần gửi lại
  if (accessToken && usedToken !== `Bearer ${accessToken}`) {
    config.headers.Authorization = `Bearer ${accessToken}`
    return http(config)
  }

  try {
    const token = await refreshAccessToken()
    config.headers.Authorization = `Bearer ${token}`
    return http(config)
  } catch (refreshError) {
    // Chỉ đăng xuất khi backend từ chối refresh; mất mạng thì giữ phiên để người dùng thử lại
    if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
      accessToken = null
      onSessionExpired?.()
    }
    throw error
  }
})
