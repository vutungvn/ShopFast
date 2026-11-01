import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerModule,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import Redis from 'ioredis';
import { Env } from '../../config/env.validation';
import { REDIS_CLIENT } from '../../infra/redis/redis.constants';
import { RateLimitGuard, rateLimitClient } from './rate-limit.guard';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * Hạn mức chung cho toàn bộ API: một bộ đếm cho mỗi người gọi, tính trên mọi route
 * (mặc định của thư viện là đếm riêng từng route).
 */
export function throttlerOptions(
  config: ConfigService<Env, true>,
  storage: ThrottlerStorage,
): ThrottlerModuleOptions {
  const userLimit = config.get('THROTTLE_USER_LIMIT', { infer: true });
  const ipLimit = config.get('THROTTLE_IP_LIMIT', { infer: true });
  return {
    throttlers: [
      {
        name: 'default',
        ttl: config.get('THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
        limit: (context) =>
          rateLimitClient(context).kind === 'user' ? userLimit : ipLimit,
        generateKey: (_context, tracker, name) => `${name}:${tracker}`,
      },
    ],
    storage,
  };
}

/** Chỉ nạp ở tiến trình API */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService<Env, true>, redis: Redis) =>
        throttlerOptions(config, new RedisThrottlerStorage(redis)),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class RateLimitModule {}
