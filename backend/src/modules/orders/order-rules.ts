import { OrderStatus } from '@prisma/client';

/** Khách chỉ huỷ được khi kho chưa xác nhận đơn */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
];

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
