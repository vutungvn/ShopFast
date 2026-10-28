import { http } from '@/api/client'
import type { LoginResponse, RegisterPayload, User } from './types'

export const authApi = {
  /** Chỉ tạo tài khoản, không đăng nhập */
  register: (payload: RegisterPayload) =>
    http.post<User>('/auth/register', payload, { skipAuthRefresh: true }).then((res) => res.data),

  /** Access token trả trong body; refresh token được backend đặt vào cookie httpOnly */
  login: (email: string, password: string) =>
    http
      .post<LoginResponse>('/auth/login', { email, password }, { skipAuthRefresh: true })
      .then((res) => res.data),

  logout: () => http.post('/auth/logout', undefined, { skipAuthRefresh: true }),

  me: () => http.get<User>('/users/me').then((res) => res.data),
}
