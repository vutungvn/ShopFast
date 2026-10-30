import { OrderStatus, Role } from '@prisma/client';
import { CartIssue } from '../../cart/dto/cart-response.dto';
import { CustomerActions } from '../order-rules';
import { OrderDetail, OrderWithItems } from '../orders.repository';

export class OrderItemResponseDto {
  productId: string;
  /** Tên tại thời điểm đặt */
  productName: string;
  /** Đơn giá tại thời điểm đặt (VND) */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export class OrderResponseDto {
  id: string;
  /** @example SF-261030-K7QM */
  code: string;
  status: OrderStatus;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  items: OrderItemResponseDto[];
  /** Tổng tiền hàng (VND) */
  subtotal: number;
  shippingFee: number;
  /** subtotal + shippingFee (VND) */
  totalAmount: number;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;

  static from(order: OrderWithItems): OrderResponseDto {
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      shippingAddress: order.shippingAddress,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice.toNumber(),
        quantity: item.quantity,
        lineTotal: item.unitPrice.mul(item.quantity).toNumber(),
      })),
      subtotal: order.totalAmount.sub(order.shippingFee).toNumber(),
      shippingFee: order.shippingFee.toNumber(),
      totalAmount: order.totalAmount.toNumber(),
      paidAt: order.paidAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
    };
  }
}

/** Dòng không đặt được, trả trong body lỗi 409 để client đánh dấu đúng dòng trong giỏ */
export class CheckoutProblemDto {
  productId: string;
  productName: string;
  issue: CartIssue;
  /** Tồn kho hiện tại */
  stock: number;
}

const PREVIEW_ITEMS = 3;

export class OrderPreviewItemDto {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

/** Một đơn trong danh sách "Đơn mua": đủ để vẽ thẻ đơn, không cần tải chi tiết */
export class OrderSummaryDto {
  id: string;
  code: string;
  status: OrderStatus;
  totalAmount: number;
  /** Số loại sản phẩm */
  itemCount: number;
  totalQuantity: number;
  /** Tối đa 3 dòng đầu */
  previewItems: OrderPreviewItemDto[];
  /** Hạn thanh toán, chỉ có khi đơn đang chờ thanh toán */
  paymentDueAt: Date | null;
  canPay: boolean;
  canCancel: boolean;
  createdAt: Date;

  static from(
    order: OrderWithItems,
    actions: CustomerActions,
  ): OrderSummaryDto {
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      totalAmount: order.totalAmount.toNumber(),
      itemCount: order.items.length,
      totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      previewItems: order.items.slice(0, PREVIEW_ITEMS).map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice.toNumber(),
        quantity: item.quantity,
      })),
      ...actions,
      createdAt: order.createdAt,
    };
  }
}

/** Ai đổi trạng thái: khách, nhân viên, hay hệ thống (vd tự huỷ đơn quá hạn) */
export type TimelineActor = 'CUSTOMER' | 'STAFF' | 'SYSTEM';

export class TimelineEntryDto {
  /** null ở mốc đầu tiên (tạo đơn) */
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  actor: TimelineActor;
  /** Chỉ trả cho nhân viên; khách không thấy danh tính nhân viên */
  changedBy?: { id: string; fullName: string; role: Role } | null;
  createdAt: Date;
}

export class OrderDetailItemDto extends OrderItemResponseDto {
  /** Để làm link về trang sản phẩm; tên và giá vẫn là của lúc đặt */
  productSlug: string;
}

export class OrderDetailDto extends OrderResponseDto {
  declare items: OrderDetailItemDto[];
  /** Lịch sử trạng thái, cũ trước mới sau */
  timeline: TimelineEntryDto[];
  paymentDueAt: Date | null;
  canPay: boolean;
  canCancel: boolean;

  static fromDetail(
    order: OrderDetail,
    actions: CustomerActions,
    { showStaff }: { showStaff: boolean },
  ): OrderDetailDto {
    const base = OrderResponseDto.from(order);
    return {
      ...base,
      items: base.items.map((item, i) => ({
        ...item,
        productSlug: order.items[i].product.slug,
      })),
      timeline: order.statusHistory.map((entry) => ({
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        note: entry.note,
        actor: !entry.changedBy
          ? 'SYSTEM'
          : entry.changedBy.role === Role.CUSTOMER
            ? 'CUSTOMER'
            : 'STAFF',
        ...(showStaff && { changedBy: entry.changedBy }),
        createdAt: entry.createdAt,
      })),
      ...actions,
    };
  }
}
