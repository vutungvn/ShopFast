import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Env } from '../../config/env.validation';
import { REDIS_CLIENT } from './redis.constants';

const READY_TIMEOUT_MS = 3000;

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const logger = new Logger('Redis');
        const client = new Redis(config.get('REDIS_URL', { infer: true }), {
          // Redis là thành phần phụ trợ: lệnh lỗi nhanh khi mất kết nối
          // để tầng gọi có thể quay về DB thay vì treo request (F04).
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
        client.on('ready', () => logger.log('Đã kết nối Redis'));
        client.on('error', (err) => logger.warn(`Lỗi Redis: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleInit, OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Chờ kết nối xong rồi mới nhận request: không có hàng đợi offline nên lệnh gửi lúc đang kết nối
   * bị từ chối ngay (health báo down, cache bị ngắt 10s). Redis chết thì sau 3s vẫn khởi động.
   */
  async onModuleInit() {
    if (this.redis.status === 'ready') return;
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.redis.off('ready', done);
        resolve();
      };
      const timer = setTimeout(done, READY_TIMEOUT_MS);
      this.redis.once('ready', done);
    });
  }

  async onApplicationShutdown() {
    await this.redis.quit();
  }
}
