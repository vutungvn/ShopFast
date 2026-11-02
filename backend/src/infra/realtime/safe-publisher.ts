import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

const WARN_INTERVAL_MS = 10_000;

/** Ghi cảnh báo tối đa 1 lần / 10s: Redis chết thì ioredis báo lỗi ở mỗi lần thử nối lại */
export function throttledWarn(logger: Logger) {
  let lastWarnAt = 0;
  return (message: string, err: Error) => {
    if (Date.now() - lastWarnAt < WARN_INTERVAL_MS) return;
    lastWarnAt = Date.now();
    // Nối thất bại cả IPv4 lẫn IPv6 thì lỗi là AggregateError không có message
    const reason =
      err.message || (err as NodeJS.ErrnoException).code || err.name;
    logger.warn(`${message}: ${reason}`);
  };
}

/**
 * Bọc client Redis đưa cho Socket.IO (adapter ở api, emitter ở worker). Thư viện gọi `publish` mà
 * không bắt lỗi: Redis mất kết nối sẽ thành unhandled rejection làm sập tiến trình Node.
 * Ở đây lỗi chỉ ghi log, sự kiện đó coi như mất.
 */
export function safePublisher(client: Redis, logger: Logger): Redis {
  const warn = throttledWarn(logger);
  const publish = (channel: string | Buffer, message: string | Buffer) =>
    client.publish(channel, message).catch((err: Error) => {
      warn('Không phát được sự kiện realtime qua Redis', err);
      return 0;
    });

  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'publish') return publish;
      const value: unknown = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
