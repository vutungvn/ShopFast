import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RefreshTokenRepository } from '../sessions/refresh-token.repository';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UsersRepository } from '../users/users.repository';
import { IssuedTokens } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

export interface ClientContext {
  userAgent?: string;
  ip?: string;
}

export type AuthResult = IssuedTokens & { user: UserResponseDto };

const INVALID_REFRESH = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Tự đăng ký luôn là CUSTOMER; vai trò khác chỉ ADMIN cấp.
   * Chỉ tạo tài khoản, không cấp token: người dùng đăng nhập để bắt đầu phiên.
   */
  async register(dto: RegisterDto): Promise<UserResponseDto> {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Email đã được sử dụng');
    }

    let user: User;
    try {
      user = await this.users.create({
        email: dto.email,
        passwordHash: await this.passwords.hash(dto.password),
        fullName: dto.fullName,
        phone: dto.phone,
        role: Role.CUSTOMER,
      });
    } catch (err) {
      // Hai request đăng ký cùng email chạy đồng thời
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw err;
    }

    return UserResponseDto.from(user);
  }

  async login(dto: LoginDto, ctx: ClientContext): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    // Luôn chạy verify (kể cả khi không có user) và trả cùng một thông báo
    const valid = await this.passwords.verify(user?.passwordHash, dto.password);
    if (!user || !valid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.buildAuthResponse(user, randomUUID(), ctx);
  }

  /**
   * Xoay vòng: token cũ bị thu hồi, cấp token mới cùng family.
   * Token đã thu hồi mà bị dùng lại => coi như bị đánh cắp, thu hồi cả family.
   */
  async refresh(rawToken: string, ctx: ClientContext): Promise<IssuedTokens> {
    const record = await this.refreshTokens.findByHash(
      this.tokens.hashRefreshToken(rawToken),
    );
    if (!record) throw new UnauthorizedException(INVALID_REFRESH);

    if (record.revokedAt) {
      await this.handleReuse(record.familyId, record.userId);
      throw new UnauthorizedException(INVALID_REFRESH);
    }
    if (record.expiresAt <= new Date()) {
      throw new UnauthorizedException(INVALID_REFRESH);
    }
    // Hai request refresh cùng token chạy đồng thời: chỉ một bên thu hồi được
    if (!(await this.refreshTokens.revokeIfActive(record.id))) {
      await this.handleReuse(record.familyId, record.userId);
      throw new UnauthorizedException(INVALID_REFRESH);
    }

    const user = await this.users.findById(record.userId);
    if (!user) throw new UnauthorizedException(INVALID_REFRESH);

    return this.issueTokens(user, record.familyId, ctx);
  }

  /** Đăng xuất phiên hiện tại. Luôn thành công để không lộ token nào hợp lệ. */
  async logout(rawToken: string): Promise<void> {
    const record = await this.refreshTokens.findByHash(
      this.tokens.hashRefreshToken(rawToken),
    );
    if (record) await this.refreshTokens.revokeFamily(record.familyId);
  }

  private async handleReuse(familyId: string, userId: string) {
    this.logger.warn(
      `Phát hiện refresh token bị dùng lại (user=${userId}, family=${familyId}), thu hồi toàn bộ phiên`,
    );
    await this.refreshTokens.revokeFamily(familyId);
  }

  private async buildAuthResponse(
    user: User,
    familyId: string,
    ctx: ClientContext,
  ): Promise<AuthResult> {
    const tokens = await this.issueTokens(user, familyId, ctx);
    return { ...tokens, user: UserResponseDto.from(user) };
  }

  private async issueTokens(
    user: User,
    familyId: string,
    ctx: ClientContext,
  ): Promise<IssuedTokens> {
    const refreshToken = this.tokens.generateRefreshToken();
    await this.refreshTokens.create({
      userId: user.id,
      familyId,
      tokenHash: this.tokens.hashRefreshToken(refreshToken),
      expiresAt: this.tokens.refreshTokenExpiry(),
      userAgent: ctx.userAgent?.slice(0, 255),
      ip: ctx.ip,
    });

    return {
      accessToken: await this.tokens.signAccessToken(user),
      refreshToken,
      expiresIn: this.tokens.accessTokenTtlSeconds,
    };
  }
}
