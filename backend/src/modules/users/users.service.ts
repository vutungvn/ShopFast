import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { paginate, PaginatedResult } from '../../common/dto/pagination.dto';
import { RefreshTokenRepository } from '../sessions/refresh-token.repository';
import { UserQueryDto } from './dto/user-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return UserResponseDto.from(user);
  }

  async list(query: UserQueryDto): Promise<PaginatedResult<UserResponseDto>> {
    const [users, total] = await this.users.list({
      role: query.role,
      skip: query.skip,
      take: query.limit,
    });
    return paginate(users.map(UserResponseDto.from), total, query);
  }

  /**
   * Đổi vai trò và thu hồi mọi phiên của người đó: lần refresh kế tiếp bị từ chối,
   * buộc đăng nhập lại để nhận token mang vai trò mới.
   */
  async changeRole(
    actorId: string,
    targetId: string,
    role: Role,
  ): Promise<UserResponseDto> {
    if (actorId === targetId) {
      throw new BadRequestException('Không thể tự thay đổi vai trò của mình');
    }
    const target = await this.users.findById(targetId);
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');
    if (target.role === role) return UserResponseDto.from(target);

    const updated = await this.users.updateRole(targetId, role);
    await this.refreshTokens.revokeAllForUser(targetId);
    return UserResponseDto.from(updated);
  }
}
