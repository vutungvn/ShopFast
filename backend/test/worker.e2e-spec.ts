import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { OrderExpiryScheduler } from '../src/modules/orders/order-expiry.scheduler';
import { WorkerModule } from '../src/worker.module';

// Cần hạ tầng đang chạy: docker compose up -d
describe('Worker (e2e)', () => {
  let worker: INestApplicationContext;

  afterAll(async () => {
    await worker?.close();
  });

  // Bắt lỗi thiếu provider (vd kéo theo controller cần JwtService) mà e2e của API không thấy
  it('khởi động được và có bộ tự huỷ đơn quá hạn', async () => {
    worker = await NestFactory.createApplicationContext(WorkerModule, {
      logger: false,
    });
    expect(worker.get(OrderExpiryScheduler)).toBeInstanceOf(
      OrderExpiryScheduler,
    );
  });
});
