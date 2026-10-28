export type Role = 'CUSTOMER' | 'SUPPORT' | 'WAREHOUSE' | 'ADMIN'

/** Khớp UserResponseDto của backend */
export type User = {
  id: string
  email: string
  fullName: string
  phone: string | null
  role: Role
  createdAt: string
}

export type LoginResponse = {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: User
}

export type RegisterPayload = {
  email: string
  password: string
  fullName: string
  phone?: string
}

/** Lý do đang ở trạng thái chưa đăng nhập, để trang đăng nhập hiện thông báo phù hợp */
export type SignedOutReason = 'logged-out' | 'session-expired'

/** State khi chuyển tới trang đăng nhập: `navigate(PATHS.login, { state })` */
export type LoginPageState = {
  notice?: SignedOutReason | 'registered'
  /** Điền sẵn ô email */
  email?: string
  /** Trang định vào trước khi bị yêu cầu đăng nhập; đăng nhập xong quay lại đây */
  from?: string
}
