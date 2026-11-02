export const TICKET_UPDATED = 'ticket:updated';

/** Room riêng của mỗi khách: chỉ nhận sự kiện ticket của chính mình */
export const userRoom = (userId: string) => `user:${userId}`;
/** CSKH + admin: nhận mọi thay đổi ticket / đề xuất của AI */
export const STAFF_SUPPORT_ROOM = 'staff:support';

/** Gửi kèm sự kiện: client chỉ dùng để tải lại, dữ liệu thật vẫn lấy qua API (có kiểm tra quyền) */
export interface TicketUpdatedEvent {
  ticketId: string;
}

export interface TicketEventsPublisher {
  /** Ticket vừa có tin mới / đổi trạng thái / có đề xuất mới hoặc đã xử lý (gọi sau khi ghi DB) */
  ticketUpdated(ticketId: string, customerId: string): void;
}

export const TICKET_EVENTS = Symbol('TICKET_EVENTS');
