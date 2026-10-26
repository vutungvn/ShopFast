import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Env } from '../../config/env.validation';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthService, ClientContext } from './auth.service';
import {
  AccessTokenResponseDto,
  AuthResponseDto,
  IssuedTokens,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  REFRESH_TOKEN_COOKIE,
  refreshTokenCookieOptions,
} from './refresh-token.cookie';

/** Các endpoint xác thực không yêu cầu đăng nhập. Refresh token đi qua cookie httpOnly. */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.isProduction =
      this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  /** Đăng ký tài khoản khách hàng. Chỉ trả thông tin user, không cấp token. */
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    return this.auth.register(dto);
  }

  /** Đăng nhập bằng email và mật khẩu */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, ...tokens } = await this.auth.login(dto, clientContext(req));
    return { ...this.sendTokens(res, tokens), user };
  }

  /** Dùng refresh token trong cookie để lấy access token mới (cookie được xoay vòng) */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponseDto> {
    const rawToken = readRefreshCookie(req);
    if (!rawToken) {
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
      );
    }
    try {
      const tokens = await this.auth.refresh(rawToken, clientContext(req));
      return this.sendTokens(res, tokens);
    } catch (err) {
      this.clearCookie(res);
      throw err;
    }
  }

  /** Đăng xuất phiên hiện tại và xoá cookie */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = readRefreshCookie(req);
    if (rawToken) await this.auth.logout(rawToken);
    this.clearCookie(res);
  }

  /** Đặt refresh token vào cookie, chỉ trả access token trong body. */
  private sendTokens(
    res: Response,
    tokens: IssuedTokens,
  ): AccessTokenResponseDto {
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      tokens.refreshToken,
      refreshTokenCookieOptions(
        this.isProduction,
        this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) *
          24 *
          60 *
          60 *
          1000,
      ),
    );
    return {
      accessToken: tokens.accessToken,
      tokenType: 'Bearer',
      expiresIn: tokens.expiresIn,
    };
  }

  private clearCookie(res: Response) {
    res.clearCookie(
      REFRESH_TOKEN_COOKIE,
      refreshTokenCookieOptions(this.isProduction),
    );
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_TOKEN_COOKIE];
  return typeof value === 'string' && value ? value : undefined;
}

function clientContext(req: Request): ClientContext {
  return { userAgent: req.get('user-agent'), ip: req.ip };
}
