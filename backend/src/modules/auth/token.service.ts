import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { JwtPayload } from '../../common/auth/auth-user';
import { Env } from '../../config/env.validation';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get accessTokenTtlSeconds(): number {
    return this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
  }

  signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwt.signAsync(payload);
  }

  /** Refresh token là chuỗi ngẫu nhiên 384 bit, không phải JWT: chỉ server tra cứu được. */
  generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  /** Token đủ ngẫu nhiên nên SHA-256 là đủ an toàn (không cần hash chậm như mật khẩu). */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  refreshTokenExpiry(from = new Date()): Date {
    const days = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
