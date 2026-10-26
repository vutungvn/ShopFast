import { Role, User } from '@prisma/client';

/** Thông tin người dùng trả về client; không bao giờ chứa passwordHash. */
export class UserResponseDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  createdAt: Date;

  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
