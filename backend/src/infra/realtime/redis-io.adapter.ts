import { INestApplication, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis, { RedisOptions } from 'ioredis';
import { Server, ServerOptions } from 'socket.io';
import { safePublisher, throttledWarn } from './safe-publisher';

/**
 * Socket.IO qua Redis pub/sub: sự kiện phát ở một tiến trình (vd worker tự huỷ đơn, hoặc api khác
 * khi chạy nhiều container) tới được client đang nối vào api này.
 * Redis lỗi: api vẫn gửi cho client của chính nó (chỉ mất sự kiện từ tiến trình khác).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger('Realtime');
  private readonly warn = throttledWarn(this.logger);
  private readonly clients: Redis[] = [];

  constructor(
    app: INestApplication,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    // Phát: lỗi nhanh khi mất kết nối thay vì xếp hàng trong bộ nhớ
    const pub = this.client({
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    // Nhận: SUBSCRIBE gửi lúc chưa kết nối thì chờ (không bao giờ báo lỗi); kết nối lại thì ioredis tự đăng ký lại
    const sub = this.client({ maxRetriesPerRequest: null });
    server.adapter(createAdapter(safePublisher(pub, this.logger), sub));
    return server;
  }

  async dispose(): Promise<void> {
    await Promise.allSettled(this.clients.map((client) => client.quit()));
  }

  private client(options: RedisOptions): Redis {
    const client = new Redis(this.redisUrl, options);
    client.on('error', (err) => this.warn('Lỗi Redis (realtime)', err));
    this.clients.push(client);
    return client;
  }
}
