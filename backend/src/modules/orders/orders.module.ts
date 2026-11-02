import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { ProductCacheModule } from '../products/product-cache.module';
import { ORDER_EVENTS } from './order-events';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule, ProductCacheModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    OrdersGateway,
    { provide: ORDER_EVENTS, useExisting: OrdersGateway },
  ],
})
export class OrdersModule {}
