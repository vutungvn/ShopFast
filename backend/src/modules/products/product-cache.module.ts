import { Module } from '@nestjs/common';
import { ProductCacheService } from './product-cache.service';

/** Tách riêng để danh mục, thương hiệu, đơn hàng và worker làm mới cache sản phẩm mà không import ProductsModule */
@Module({
  providers: [ProductCacheService],
  exports: [ProductCacheService],
})
export class ProductCacheModule {}
