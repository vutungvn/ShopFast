import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validation';
import { OrderExpiryScheduler } from './order-expiry.scheduler';
import { OrdersService } from './orders.service';

function setup(expire: () => Promise<number>) {
  const orders = {
    expireOverdueOrders: jest.fn(expire),
  } as unknown as jest.Mocked<OrdersService>;
  const config = { get: () => 60 } as unknown as ConfigService<Env, true>;
  return { orders, scheduler: new OrderExpiryScheduler(orders, config) };
}

describe('OrderExpiryScheduler.sweep', () => {
  it('lượt trước chưa xong => bỏ qua lượt mới', async () => {
    let finish: (n: number) => void = () => {};
    const { orders, scheduler } = setup(
      () => new Promise<number>((resolve) => (finish = resolve)),
    );

    const first = scheduler.sweep();
    await scheduler.sweep();
    finish(0);
    await first;

    expect(orders.expireOverdueOrders).toHaveBeenCalledTimes(1);
  });

  it('lỗi một lượt => không ném ra ngoài, lượt sau vẫn chạy', async () => {
    const { orders, scheduler } = setup(() => Promise.reject(new Error('db')));
    jest.spyOn(scheduler['logger'], 'error').mockImplementation(() => {});

    await expect(scheduler.sweep()).resolves.toBeUndefined();
    await scheduler.sweep();

    expect(orders.expireOverdueOrders).toHaveBeenCalledTimes(2);
  });
});
