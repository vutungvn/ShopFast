import { Role } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateRoleDto {
  /** Vai trò mới: CUSTOMER, SUPPORT, WAREHOUSE hoặc ADMIN */
  @IsEnum(Role, { message: 'role không hợp lệ' })
  role: Role;
}
