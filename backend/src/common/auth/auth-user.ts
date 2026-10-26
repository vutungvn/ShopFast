import { Role } from '@prisma/client';

/** Nội dung access token (JWT). */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

/** Người dùng đã xác thực, gắn vào request bởi JwtAuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
