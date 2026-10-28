/** Đường dẫn các trang, dùng chung cho router và Link để không gõ tay chuỗi. */
export const PATHS = {
  home: '/',
  product: '/products/:slug',
  account: '/account',
  login: '/login',
  register: '/register',
} as const

export const productPath = (slug: string) => `/products/${encodeURIComponent(slug)}`
