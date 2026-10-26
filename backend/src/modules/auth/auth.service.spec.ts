import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma, RefreshToken, Role, User } from '@prisma/client';
import { RefreshTokenRepository } from '../sessions/refresh-token.repository';
import { UsersRepository } from '../users/users.repository';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const user: User = {
  id: 'u1',
  email: 'khach@shopfast.vn',
  passwordHash: 'hashed',
  fullName: 'Khách',
  phone: null,
  role: Role.CUSTOMER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const tokenRecord = (overrides: Partial<RefreshToken> = {}): RefreshToken => ({
  id: 't1',
  userId: user.id,
  familyId: 'f1',
  tokenHash: 'hash:old',
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  userAgent: null,
  ip: null,
  createdAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<
    Pick<UsersRepository, 'findByEmail' | 'findById' | 'create'>
  >;
  let refreshTokens: jest.Mocked<
    Pick<
      RefreshTokenRepository,
      'create' | 'findByHash' | 'revokeIfActive' | 'revokeFamily'
    >
  >;
  let passwords: jest.Mocked<Pick<PasswordService, 'hash' | 'verify'>>;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    refreshTokens = {
      create: jest.fn().mockResolvedValue(tokenRecord()),
      findByHash: jest.fn(),
      revokeIfActive: jest.fn(),
      revokeFamily: jest.fn(),
    };
    passwords = { hash: jest.fn(), verify: jest.fn() };
    const tokens: Partial<TokenService> = {
      accessTokenTtlSeconds: 900,
      signAccessToken: jest.fn().mockResolvedValue('access'),
      generateRefreshToken: jest.fn().mockReturnValue('new'),
      hashRefreshToken: jest.fn((t: string) => `hash:${t}`),
      refreshTokenExpiry: jest.fn().mockReturnValue(new Date()),
    };
    service = new AuthService(
      users as unknown as UsersRepository,
      refreshTokens as unknown as RefreshTokenRepository,
      passwords as unknown as PasswordService,
      tokens as TokenService,
    );
  });

  describe('register', () => {
    const dto = {
      email: user.email,
      password: 'MatKhau123',
      fullName: 'Khách',
    };

    it('tạo user CUSTOMER, lưu mật khẩu đã hash, chỉ trả thông tin user và không cấp token', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwords.hash.mockResolvedValue('hashed');
      users.create.mockResolvedValue(user);

      const res = await service.register(dto);

      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: Role.CUSTOMER,
          passwordHash: 'hashed',
        }),
      );
      expect(res).toMatchObject({ id: user.id, email: user.email });
      expect(res).not.toHaveProperty('passwordHash');
      expect(res).not.toHaveProperty('accessToken');
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('từ chối email đã tồn tại', async () => {
      users.findByEmail.mockResolvedValue(user);
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('trả 409 khi hai request đăng ký cùng email chạy đồng thời (P2002)', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('đăng nhập thành công với mật khẩu đúng', async () => {
      users.findByEmail.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);
      const res = await service.login({ email: user.email, password: 'x' }, {});
      expect(res.user.id).toBe(user.id);
    });

    it('sai mật khẩu và email không tồn tại trả cùng một thông báo', async () => {
      passwords.verify.mockResolvedValue(false);

      users.findByEmail.mockResolvedValue(user);
      const wrongPassword = service.login(
        { email: user.email, password: 'x' },
        {},
      );
      await expect(wrongPassword).rejects.toThrow(
        'Email hoặc mật khẩu không đúng',
      );

      users.findByEmail.mockResolvedValue(null);
      const unknownEmail = service.login(
        { email: 'khong-co@shopfast.vn', password: 'x' },
        {},
      );
      await expect(unknownEmail).rejects.toThrow(
        'Email hoặc mật khẩu không đúng',
      );
      // Vẫn chạy verify khi email không tồn tại (chống dò email qua thời gian phản hồi)
      expect(passwords.verify).toHaveBeenLastCalledWith(undefined, 'x');
    });
  });

  describe('refresh', () => {
    it('xoay vòng: thu hồi token cũ, cấp token mới cùng family', async () => {
      refreshTokens.findByHash.mockResolvedValue(tokenRecord());
      refreshTokens.revokeIfActive.mockResolvedValue(true);
      users.findById.mockResolvedValue(user);

      const res = await service.refresh('old', {});

      expect(refreshTokens.revokeIfActive).toHaveBeenCalledWith('t1');
      expect(refreshTokens.create).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: 'f1', tokenHash: 'hash:new' }),
      );
      expect(res.refreshToken).toBe('new');
    });

    it('token không tồn tại => 401', async () => {
      refreshTokens.findByHash.mockResolvedValue(null);
      await expect(service.refresh('bad', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('token hết hạn => 401, không cấp token mới', async () => {
      refreshTokens.findByHash.mockResolvedValue(
        tokenRecord({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.refresh('old', {})).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('dùng lại token đã thu hồi => thu hồi cả family', async () => {
      refreshTokens.findByHash.mockResolvedValue(
        tokenRecord({ revokedAt: new Date() }),
      );
      await expect(service.refresh('old', {})).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('f1');
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('hai request refresh đồng thời: bên thua bị coi là dùng lại', async () => {
      refreshTokens.findByHash.mockResolvedValue(tokenRecord());
      refreshTokens.revokeIfActive.mockResolvedValue(false);
      await expect(service.refresh('old', {})).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('f1');
    });
  });

  describe('logout', () => {
    it('thu hồi family của token', async () => {
      refreshTokens.findByHash.mockResolvedValue(tokenRecord());
      await service.logout('old');
      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('f1');
    });

    it('token không tồn tại vẫn thành công (không lộ thông tin)', async () => {
      refreshTokens.findByHash.mockResolvedValue(null);
      await expect(service.logout('bad')).resolves.toBeUndefined();
    });
  });
});
