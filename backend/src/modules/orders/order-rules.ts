import { OrderStatus } from '@prisma/client';

/** Khách chỉ huỷ được khi kho chưa xác nhận đơn */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
];

/** Nhân viên kho / admin huỷ được tới hết bước đóng gói; đã giao cho vận chuyển thì không huỷ nữa */
export const STAFF_CANCELLABLE: readonly OrderStatus[] = [
  ...CUSTOMER_CANCELLABLE,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKING,
];

/** Kho đẩy đơn đi tiếp từng bước, không nhảy cóc, không lùi. Đơn chưa thanh toán thì kho chưa xử lý. */
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.PAID]: OrderStatus.CONFIRMED,
  [OrderStatus.CONFIRMED]: OrderStatus.PACKING,
  [OrderStatus.PACKING]: OrderStatus.SHIPPING,
  [OrderStatus.SHIPPING]: OrderStatus.DELIVERED,
};

/** Bước kế tiếp kho được chuyển; null nếu đơn không đi tiếp được nữa */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  return NEXT_STATUS[status] ?? null;
}

/** Tên trạng thái hiển thị trong thông báo lỗi */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING_PAYMENT]: 'Chờ thanh toán',
  [OrderStatus.PAID]: 'Đã thanh toán',
  [OrderStatus.CONFIRMED]: 'Đã xác nhận',
  [OrderStatus.PACKING]: 'Đang đóng gói',
  [OrderStatus.SHIPPING]: 'Đang giao',
  [OrderStatus.DELIVERED]: 'Đã giao',
  [OrderStatus.CANCELLED]: 'Đã huỷ',
};

/** Những gì khách làm được với đơn ngay lúc này; UI chỉ dựa vào đây để ẩn/hiện nút */
export interface CustomerActions {
  /** Hạn thanh toán; chỉ có khi đơn đang chờ thanh toán */
  paymentDueAt: Date | null;
  canPay: boolean;
  canCancel: boolean;
}

export function customerActions(
  order: { status: OrderStatus; createdAt: Date },
  paymentTimeoutMs: number,
  now = new Date(),
): CustomerActions {
  const pending = order.status === OrderStatus.PENDING_PAYMENT;
  const paymentDueAt = pending
    ? new Date(order.createdAt.getTime() + paymentTimeoutMs)
    : null;
  return {
    paymentDueAt,
    // Quá hạn mà job tự huỷ chưa chạy: vẫn PENDING_PAYMENT nhưng không thanh toán được nữa
    canPay: paymentDueAt !== null && now < paymentDueAt,
    canCancel: CUSTOMER_CANCELLABLE.includes(order.status),
  };
}
