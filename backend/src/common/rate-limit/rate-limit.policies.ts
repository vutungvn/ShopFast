import { createHash } from 'node:crypto';
import { applyDecorators, ExecutionContext, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiTooManyRequestsResponse } from '@nestjs/swagger';
import {
  ThrottlerModuleOptions,
  ThrottlerOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Env } from '../../config/env.validation';
import { RateLimitClient, rateLimitClientOf } from './rate-limit-client';

/** Endpoint nhạy cảm có hạn mức riêng, chặt hơn hạn mức chung */
export type RateLimitPurpose =
  | 'login'
  | 'register'
  | 'refresh'
  | 'order'
  | 'otp'
  | 'ticket'
  | 'ticket-message';

const PURPOSE_KEY = 'rateLimitPurpose';

/**
 * Gắn hạn mức riêng cho endpoint (vẫn tính cả hạn mức chung).
 * `otp` đã định nghĩa sẵn cho endpoint gửi mã xác thực ở Giai đoạn 5.
 */
export const RateLimit = (purpose: RateLimitPurpose) =>
  applyDecorators(
    SetMetadata(PURPOSE_KEY, purpose),
    ApiTooManyRequestsResponse({
      description:
        'Vượt hạn mức: header `Retry-After` (giây), body `{ statusCode, error, message, retryAfter }`',
    }),
  );

/** Câu báo lỗi 429 theo tên hạn mức (chưa gồm thời gian chờ) */
const MESSAGES: Record<string, string> = {
  default: 'Bạn thao tác quá nhanh',
  login: 'Bạn đăng nhập quá nhiều lần',
  register: 'Bạn đã đăng ký quá nhiều tài khoản',
  refresh: 'Bạn thao tác quá nhanh',
  order: 'Bạn đặt đơn quá nhanh',
  'otp-email': 'Bạn đã yêu cầu gửi mã quá nhiều lần',
  'otp-ip': 'Bạn đã yêu cầu gửi mã quá nhiều lần',
  ticket: 'Bạn đã tạo quá nhiều yêu cầu hỗ trợ',
  'ticket-message': 'Bạn gửi tin nhắn quá nhanh',
};

export const rateLimitMessage = (throttlerName: string) =>
  MESSAGES[throttlerName] ?? MESSAGES.default;

const MINUTE = 60_000;
const reflector = new Reflector();

type Tracker = (request: Record<string, unknown>) => string;
const client = (request: Record<string, unknown>): RateLimitClient =>
  rateLimitClientOf(request);
const byIp: Tracker = (request) => `ip:${client(request).ip}`;
const byUserOrIp: Tracker = (request) => {
  const { userId, ip } = client(request);
  return userId ? `user:${userId}` : `ip:${ip}`;
};
/** Theo email nhận mã (băm, không lưu email trong Redis); thiếu email thì theo IP */
const byEmail: Tracker = (request) => {
  const email = (request.body as { email?: unknown } | undefined)?.email;
  if (typeof email !== 'string' || !email.trim()) return byIp(request);
  const hash = createHash('sha256').update(email.trim().toLowerCase());
  return `email:${hash.digest('hex').slice(0, 32)}`;
};

/** Hạn mức chỉ áp cho endpoint gắn `@RateLimit(purpose)` */
function forPurpose(
  purpose: RateLimitPurpose,
  options: ThrottlerOptions,
): ThrottlerOptions {
  return {
    ...options,
    skipIf: (context: ExecutionContext) =>
      reflector.getAllAndOverride<RateLimitPurpose>(PURPOSE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) !== purpose,
  };
}

/**
 * Toàn bộ hạn mức. Mỗi bộ đếm là (tên hạn mức, người gọi), không chia theo route
 * (mặc định của thư viện là đếm riêng từng route).
 */
export function throttlerOptions(
  config: ConfigService<Env, true>,
  storage: ThrottlerStorage,
): ThrottlerModuleOptions {
  const userLimit = config.get('THROTTLE_USER_LIMIT', { infer: true });
  const ipLimit = config.get('THROTTLE_IP_LIMIT', { infer: true });
  return {
    generateKey: (_context, tracker, name) => `${name}:${tracker}`,
    throttlers: [
      // Chung: đã đăng nhập theo tài khoản; chưa thì theo IP, nới hơn vì nhiều người có thể chung IP (NAT)
      {
        name: 'default',
        ttl: config.get('THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
        limit: (context) =>
          rateLimitClientOf(context.switchToHttp().getRequest()).userId
            ? userLimit
            : ipLimit,
        getTracker: byUserOrIp,
      },
      // Dò nhiều tài khoản từ một IP; dò một tài khoản đã có khoá leo thang theo email (LoginAttemptsService)
      forPurpose('login', {
        name: 'login',
        ttl: MINUTE,
        limit: config.get('THROTTLE_LOGIN_LIMIT', { infer: true }),
        getTracker: byIp,
      }),
      forPurpose('register', {
        name: 'register',
        ttl: 15 * MINUTE,
        limit: 5,
        getTracker: byIp,
      }),
      // Nới tay: refresh bị chặn thì người dùng bị đăng xuất oan
      forPurpose('refresh', {
        name: 'refresh',
        ttl: MINUTE,
        limit: 30,
        getTracker: byIp,
      }),
      // Thay cho "đặt đơn khuyến mãi" (chưa có khuyến mãi): chặn bot đặt đơn giữ hàng
      forPurpose('order', {
        name: 'order',
        ttl: MINUTE,
        limit: config.get('THROTTLE_ORDER_LIMIT', { infer: true }),
        getTracker: byUserOrIp,
      }),
      // Mỗi tin nhắn gọi AI (gói miễn phí có hạn mức theo ngày): chặn spam làm hết lượt của cả hệ thống
      forPurpose('ticket', {
        name: 'ticket',
        ttl: 15 * MINUTE,
        limit: 5,
        getTracker: byUserOrIp,
      }),
      forPurpose('ticket-message', {
        name: 'ticket-message',
        ttl: MINUTE,
        limit: 10,
        getTracker: byUserOrIp,
      }),
      forPurpose('otp', {
        name: 'otp-email',
        ttl: 15 * MINUTE,
        limit: 3,
        getTracker: byEmail,
      }),
      forPurpose('otp', {
        name: 'otp-ip',
        ttl: 60 * MINUTE,
        limit: 10,
        getTracker: byIp,
      }),
    ],
    storage,
  };
}
