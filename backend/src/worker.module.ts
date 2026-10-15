import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';

/** Tiến trình Worker: xử lý hàng đợi và tác vụ theo lịch (giai đoạn 5). */
@Module({
  imports: [CoreModule],
})
export class WorkerModule {}
