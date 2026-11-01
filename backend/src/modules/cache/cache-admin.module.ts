import { Module } from '@nestjs/common';
import { CacheController } from './cache.controller';

/** Chỉ nạp ở tiến trình API (CacheService dùng chung nằm ở CoreModule) */
@Module({
  controllers: [CacheController],
})
export class CacheAdminModule {}
