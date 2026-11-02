import { Module } from '@nestjs/common';
import { CartRepository } from '../cart/cart.repository';
import { ProductCacheModule } from '../products/product-cache.module';
import { ORDER_EVENTS } from './order-events';
import { OrderExpiryScheduler } from './order-expiry.scheduler';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { RedisOrderEventsPublisher } from './redis-order-events.publisher';

/**
 * Chỉ nạp ở tiến trình worker, để API chạy nhiều bản không quét trùng.
 * Khai báo thẳng các provider cần dùng thay vì import OrdersModule: kéo theo controller
 * thì worker phải có JwtService cho guard dù không phục vụ HTTP.
 */
@Module({
  imports: [ProductCacheModule],
  providers: [
    OrderExpiryScheduler,
    OrdersService,
    OrdersRepository,
    CartRepository,
    // Worker không có Socket.IO server: sự kiện tự huỷ đơn đi qua Redis tới api
    { provide: ORDER_EVENTS, useClass: RedisOrderEventsPublisher },
  ],
})
export class OrderExpiryModule {}
