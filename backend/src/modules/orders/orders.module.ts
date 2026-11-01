import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { ProductCacheModule } from '../products/product-cache.module';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule, ProductCacheModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
