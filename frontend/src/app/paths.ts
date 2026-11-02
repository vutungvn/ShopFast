/** Đường dẫn các trang, dùng chung cho router và Link để không gõ tay chuỗi. */
export const PATHS = {
  home: '/',
  product: '/products/:slug',
  cart: '/cart',
  checkout: '/checkout',
  orders: '/orders',
  order: '/orders/:id',
  orderPayment: '/orders/:id/payment',
  staffOrders: '/staff/orders',
  staffOrder: '/staff/orders/:id',
  staffInventory: '/staff/inventory',
  support: '/support',
  supportTicket: '/support/:id',
  staffTickets: '/staff/tickets',
  staffTicket: '/staff/tickets/:id',
  staffAgentActions: '/staff/agent-actions',
  account: '/account',
  login: '/login',
  register: '/register',
} as const

export const productPath = (slug: string) => `/products/${encodeURIComponent(slug)}`
export const orderPath = (id: string) => `/orders/${encodeURIComponent(id)}`
export const orderPaymentPath = (id: string) => `/orders/${encodeURIComponent(id)}/payment`
export const staffOrderPath = (id: string) => `/staff/orders/${encodeURIComponent(id)}`
export const supportTicketPath = (id: string) => `/support/${encodeURIComponent(id)}`
export const staffTicketPath = (id: string) => `/staff/tickets/${encodeURIComponent(id)}`
