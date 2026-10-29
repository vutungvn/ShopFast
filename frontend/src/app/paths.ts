/** Đường dẫn các trang, dùng chung cho router và Link để không gõ tay chuỗi. */
export const PATHS = {
  home: '/',
  product: '/products/:slug',
  cart: '/cart',
  account: '/account',
  login: '/login',
  register: '/register',
} as const

export const productPath = (slug: string) => `/products/${encodeURIComponent(slug)}`
