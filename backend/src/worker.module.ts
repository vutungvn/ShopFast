import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';
import { OrderExpiryModule } from './modules/orders/order-expiry.module';

/** Tiến trình Worker: xử lý hàng đợi và tác vụ theo lịch. */
@Module({
  imports: [CoreModule, OrderExpiryModule],
})
export class WorkerModule {}
