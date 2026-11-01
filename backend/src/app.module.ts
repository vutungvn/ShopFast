import { Module } from '@nestjs/common';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { CoreModule } from './core.module';
import { AuthModule } from './modules/auth/auth.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CacheAdminModule } from './modules/cache/cache-admin.module';
import { CartModule } from './modules/cart/cart.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { UsersModule } from './modules/users/users.module';

/** Tiến trình API: HTTP + WebSocket. */
@Module({
  imports: [
    CoreModule,
    RateLimitModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    CacheAdminModule,
  ],
})
export class AppModule {}
