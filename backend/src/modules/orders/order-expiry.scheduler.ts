import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validation';
import { OrdersService } from './orders.service';

/**
 * Chạy trong tiến trình worker: định kỳ tự huỷ đơn quá hạn thanh toán và trả kho.
 * Giai đoạn 5 chuyển sang delayed job của BullMQ (mỗi đơn một job hẹn giờ).
 */
@Injectable()
export class OrderExpiryScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OrderExpiryScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap() {
    const seconds = this.config.get('ORDER_EXPIRY_SWEEP_SECONDS', {
      infer: true,
    });
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), seconds * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Một lượt quét. Lượt trước chưa xong (nhiều đơn, DB chậm) thì bỏ qua lượt này. */
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const cancelled = await this.orders.expireOverdueOrders();
      if (cancelled > 0) {
        this.logger.log(`Đã tự huỷ ${cancelled} đơn quá hạn thanh toán`);
      }
    } catch (err) {
      // Lỗi một lượt không làm dừng worker; lượt sau quét lại
      this.logger.error(
        'Quét đơn quá hạn thất bại',
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      this.running = false;
    }
  }
}
