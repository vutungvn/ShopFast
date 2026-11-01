import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  normalizeIp,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Request } from 'express';
import { Env } from '../../config/env.validation';
import { JwtPayload } from '../auth/auth-user';
import { bearerToken } from '../auth/bearer-token';
import { RateLimitedRequest } from './rate-limit-client';
import { rateLimitMessage } from './rate-limit.policies';
import { TooManyRequestsException } from './too-many-requests.exception';

/**
 * Rate limit toàn cục (hạn mức trong rate-limit.policies.ts).
 * Guard toàn cục chạy trước JwtAuthGuard của từng route nên tự kiểm tra token tại đây;
 * token giả hoặc hết hạn thì coi như chưa đăng nhập.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {
    super(options, storage, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.get('THROTTLE_DISABLED', { infer: true })) return true;
    const request = context
      .switchToHttp()
      .getRequest<Request & RateLimitedRequest>();
    // Phải có trước khi thư viện tính hạn mức (hạn mức phụ thuộc người gọi)
    request.rateLimitClient = {
      userId: await this.userIdFromToken(request),
      // req.ip đã tính tới TRUST_PROXY_HOPS; IPv6 gộp theo dải /64 vì một máy đổi được nhiều địa chỉ trong dải
      ip: normalizeIp(request.ip ?? 'unknown'),
    };
    return super.canActivate(context);
  }

  /** 429 tiếng Việt theo từng loại hạn mức thay cho câu tiếng Anh mặc định */
  protected async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    // Khoá có dạng "<tên hạn mức>:<người gọi>" (generateKey trong rate-limit.policies.ts)
    const name = detail.key.slice(0, detail.key.indexOf(':'));
    throw new TooManyRequestsException(
      rateLimitMessage(name),
      detail.timeToBlockExpire,
    );
  }

  private async userIdFromToken(request: Request): Promise<string | undefined> {
    const token = bearerToken(request);
    if (!token) return undefined;
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        algorithms: ['HS256'],
      });
      return payload.sub;
    } catch {
      // Token không hợp lệ: đếm theo IP, route cần đăng nhập sẽ tự trả 401
      return undefined;
    }
  }
}
