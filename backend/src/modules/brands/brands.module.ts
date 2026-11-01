import { Module } from '@nestjs/common';
import { ProductCacheModule } from '../products/product-cache.module';
import { BrandsController } from './brands.controller';
import { BrandsRepository } from './brands.repository';
import { BrandsService } from './brands.service';

@Module({
  imports: [ProductCacheModule],
  controllers: [BrandsController],
  providers: [BrandsService, BrandsRepository],
  exports: [BrandsService],
})
export class BrandsModule {}
