import { Inject, Injectable, Logger } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import Redis from 'ioredis';
import { safePublisher } from '../../infra/realtime/safe-publisher';
import { REDIS_CLIENT } from '../../infra/redis/redis.constants';
import {
  ORDER_UPDATED,
  OrderEventsPublisher,
  OrderUpdatedEvent,
  orderRoom,
  STAFF_ORDERS_ROOM,
} from './order-events';

/** Worker không có Socket.IO server: đẩy sự kiện vào Redis, adapter của api chuyển tới client */
@Injectable()
export class RedisOrderEventsPublisher implements OrderEventsPublisher {
  private readonly emitter: Emitter;

  constructor(@Inject(REDIS_CLIENT) redis: Redis) {
    this.emitter = new Emitter(safePublisher(redis, new Logger('Realtime')));
  }

  orderUpdated(event: OrderUpdatedEvent): void {
    this.emitter
      .to([orderRoom(event.orderId), STAFF_ORDERS_ROOM])
      .emit(ORDER_UPDATED, event);
  }
}
