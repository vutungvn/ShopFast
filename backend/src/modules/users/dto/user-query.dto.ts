import { Role } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class UserQueryDto extends PaginationQueryDto {
  /** Lọc theo vai trò */
  @IsOptional()
  @IsEnum(Role, { message: 'role không hợp lệ' })
  role?: Role;
}
