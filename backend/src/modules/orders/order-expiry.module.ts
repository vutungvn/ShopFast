import { Module } from '@nestjs/common';
import { CartRepository } from '../cart/cart.repository';
import { OrderExpiryScheduler } from './order-expiry.scheduler';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

/**
 * Chỉ nạp ở tiến trình worker, để API chạy nhiều bản không quét trùng.
 * Khai báo thẳng các provider cần dùng thay vì import OrdersModule: kéo theo controller
 * thì worker phải có JwtService cho guard dù không phục vụ HTTP.
 */
@Module({
  providers: [
    OrderExpiryScheduler,
    OrdersService,
    OrdersRepository,
    CartRepository,
  ],
})
export class OrderExpiryModule {}
