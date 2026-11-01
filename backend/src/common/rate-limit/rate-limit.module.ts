import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import { Env } from '../../config/env.validation';
import { REDIS_CLIENT } from '../../infra/redis/redis.constants';
import { RateLimitGuard } from './rate-limit.guard';
import { throttlerOptions } from './rate-limit.policies';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { TooManyRequestsFilter } from './too-many-requests.exception';

/** Chỉ nạp ở tiến trình API */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService<Env, true>, redis: Redis) =>
        throttlerOptions(config, new RedisThrottlerStorage(redis)),
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_FILTER, useClass: TooManyRequestsFilter },
  ],
})
export class RateLimitModule {}
