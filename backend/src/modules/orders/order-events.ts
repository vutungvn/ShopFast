import { OrderStatus } from '@prisma/client';
import { TimelineActor } from './dto/order-response.dto';

/** Tên sự kiện Socket.IO gửi cho client khi đơn đổi trạng thái */
export const ORDER_UPDATED = 'order:updated';

/** Room của từng đơn: khách chủ đơn và nhân viên đang mở đơn đó */
export const orderRoom = (orderId: string) => `order:${orderId}`;

/** Room nhân viên (kho, CSKH, admin) tự vào khi kết nối: nhận mọi đơn mới / đổi trạng thái */
export const STAFF_ORDERS_ROOM = 'staff:orders';

export interface OrderUpdatedEvent {
  orderId: string;
  code: string;
  status: OrderStatus;
  /** null = đơn vừa được tạo */
  previousStatus: OrderStatus | null;
  actor: TimelineActor;
  note: string | null;
  /** Thời điểm phát (ISO) – client dùng để đo độ trễ */
  changedAt: string;
}

/** Nơi phát sự kiện đơn hàng: api phát thẳng qua Socket.IO, worker phát qua Redis */
export interface OrderEventsPublisher {
  /** Gọi SAU khi transaction đã commit. Không ném lỗi: mất sự kiện thì client tự tải lại khi kết nối lại */
  orderUpdated(event: OrderUpdatedEvent): void;
}

export const ORDER_EVENTS = Symbol('ORDER_EVENTS');
