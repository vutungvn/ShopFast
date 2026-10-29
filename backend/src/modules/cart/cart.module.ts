import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartRepository } from './cart.repository';
import { CartService } from './cart.service';

@Module({
  controllers: [CartController],
  providers: [CartService, CartRepository],
  // Bước đặt đơn đọc giỏ và xoá các dòng đã đặt
  exports: [CartRepository],
})
export class CartModule {}
