import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { RefreshTokenRepository } from '../sessions/refresh-token.repository';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const target: User = {
  id: 'u2',
  email: 'nv@shopfast.vn',
  passwordHash: 'hashed',
  fullName: 'Nhân viên',
  phone: null,
  role: Role.CUSTOMER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService.changeRole', () => {
  let users: jest.Mocked<Pick<UsersRepository, 'findById' | 'updateRole'>>;
  let refreshTokens: jest.Mocked<
    Pick<RefreshTokenRepository, 'revokeAllForUser'>
  >;
  let service: UsersService;

  beforeEach(() => {
    users = { findById: jest.fn(), updateRole: jest.fn() };
    refreshTokens = { revokeAllForUser: jest.fn() };
    service = new UsersService(
      users as unknown as UsersRepository,
      refreshTokens as unknown as RefreshTokenRepository,
    );
  });

  it('đổi vai trò và thu hồi mọi phiên của người đó', async () => {
    users.findById.mockResolvedValue(target);
    users.updateRole.mockResolvedValue({ ...target, role: Role.WAREHOUSE });

    const res = await service.changeRole('admin', 'u2', Role.WAREHOUSE);

    expect(res.role).toBe(Role.WAREHOUSE);
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u2');
  });

  it('không cho admin tự đổi vai trò của mình', async () => {
    await expect(service.changeRole('u2', 'u2', Role.CUSTOMER)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('người dùng không tồn tại => 404', async () => {
    users.findById.mockResolvedValue(null);
    await expect(
      service.changeRole('admin', 'u404', Role.SUPPORT),
    ).rejects.toThrow(NotFoundException);
  });

  it('vai trò không đổi thì không thu hồi phiên', async () => {
    users.findById.mockResolvedValue(target);
    await service.changeRole('admin', 'u2', Role.CUSTOMER);
    expect(users.updateRole).not.toHaveBeenCalled();
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });
});
