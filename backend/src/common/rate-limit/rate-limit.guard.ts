import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  normalizeIp,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Request } from 'express';
import { Env } from '../../config/env.validation';
import { JwtPayload } from '../auth/auth-user';
import { bearerToken } from '../auth/bearer-token';

/** Ai đang gọi API: tài khoản (access token hợp lệ) hoặc IP */
export interface RateLimitClient {
  kind: 'user' | 'ip';
  id: string;
}

type RateLimitedRequest = Request & { rateLimitClient?: RateLimitClient };

/** Người gọi của request hiện tại (RateLimitGuard đã xác định trước khi tính hạn mức) */
export function rateLimitClient(context: ExecutionContext): RateLimitClient {
  const request = context.switchToHttp().getRequest<RateLimitedRequest>();
  if (!request.rateLimitClient) {
    throw new Error('RateLimitGuard chưa xác định người gọi');
  }
  return request.rateLimitClient;
}

/**
 * Rate limit toàn cục: đếm theo tài khoản khi đã đăng nhập, theo IP khi chưa.
 * Guard toàn cục chạy trước JwtAuthGuard của từng route nên tự kiểm tra token tại đây;
 * token giả hoặc hết hạn thì tính theo IP.
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
    const request = context.switchToHttp().getRequest<RateLimitedRequest>();
    // Phải có trước khi thư viện tính hạn mức (hạn mức phụ thuộc người gọi)
    request.rateLimitClient = await this.identify(request);
    return super.canActivate(context);
  }

  protected async getTracker(request: RateLimitedRequest): Promise<string> {
    const client = request.rateLimitClient!;
    return `${client.kind}:${client.id}`;
  }

  private async identify(request: Request): Promise<RateLimitClient> {
    const token = bearerToken(request);
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
          algorithms: ['HS256'],
        });
        return { kind: 'user', id: payload.sub };
      } catch {
        // Token không hợp lệ: đếm theo IP, route cần đăng nhập sẽ tự trả 401
      }
    }
    // req.ip đã tính tới TRUST_PROXY_HOPS; IPv6 gộp theo dải /64 vì một máy có thể đổi nhiều địa chỉ trong dải
    return { kind: 'ip', id: normalizeIp(request.ip ?? 'unknown') };
  }
}
