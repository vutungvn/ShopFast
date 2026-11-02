import type { FunctionDeclaration } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { AgentActionStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { STAFF_CANCELLABLE, STATUS_LABELS } from '../orders/order-rules';

/** Ticket mà agent đang trả lời. Phạm vi dữ liệu lấy từ đây, KHÔNG lấy từ tham số model gửi lên */
export interface ToolContext {
  ticketId: string;
  customerId: string;
}

export type ToolResult = Record<string, unknown>;

/** Thao tác ghi duy nhất agent được đề xuất; chỉ chạy khi CSKH duyệt (AgentActionsService) */
export const CANCEL_ORDER = 'CANCEL_ORDER';
export interface CancelOrderPayload {
  orderId: string;
  orderCode: string;
}

export function cancelPayloadOf(payload: Prisma.JsonValue): CancelOrderPayload {
  const value = (payload ?? {}) as Record<string, unknown>;
  return {
    orderId: typeof value.orderId === 'string' ? value.orderId : '',
    orderCode: typeof value.orderCode === 'string' ? value.orderCode : '',
  };
}

/** Mã đơn SF-YYMMDD-XXXX (order-code.ts) */
export const ORDER_CODE_PATTERN = /SF-\d{6}-[A-Z0-9]{4}/gi;
const RECENT_ORDERS = 5;
const HISTORY_ENTRIES = 5;

const vnTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
});
const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});
const formatTime = (date: Date | null) => (date ? vnTime.format(date) : null);
const formatMoney = (amount: Prisma.Decimal) => vnd.format(amount.toNumber());

const stringArg = (args: Record<string, unknown>, key: string) => {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : '';
};

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_order_status',
    description:
      'Tra trạng thái và chi tiết một đơn hàng của khách đang chat theo mã đơn. Chỉ tìm trong đơn của khách này.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        orderCode: {
          type: 'string',
          description: 'Mã đơn dạng SF-YYMMDD-XXXX',
        },
      },
      required: ['orderCode'],
    },
  },
  {
    name: 'list_my_recent_orders',
    description: `Liệt kê tối đa ${RECENT_ORDERS} đơn gần nhất của khách đang chat (khi khách không nhớ mã đơn).`,
  },
  {
    name: 'check_inventory',
    description:
      'Kiểm tra giá, tồn kho và tình trạng bán của một sản phẩm theo mã SKU.',
    parametersJsonSchema: {
      type: 'object',
      properties: { sku: { type: 'string', description: 'Mã SKU sản phẩm' } },
      required: ['sku'],
    },
  },
  {
    name: 'propose_cancel_order',
    description:
      'Gửi đề xuất huỷ đơn để nhân viên CSKH duyệt. KHÔNG huỷ ngay: đơn chỉ bị huỷ sau khi nhân viên duyệt.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        orderCode: { type: 'string', description: 'Mã đơn cần huỷ' },
        reason: { type: 'string', description: 'Lý do huỷ khách đưa ra' },
      },
      required: ['orderCode', 'reason'],
    },
  },
];

/** Công cụ agent gọi được. Lỗi nghiệp vụ trả về trong kết quả để model giải thích cho khách */
@Injectable()
export class SupportTools {
  constructor(private readonly prisma: PrismaService) {}

  run(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    switch (name) {
      case 'get_order_status':
        return this.getOrderStatus(stringArg(args, 'orderCode'), context);
      case 'list_my_recent_orders':
        return this.listRecentOrders(context);
      case 'check_inventory':
        return this.checkInventory(stringArg(args, 'sku'));
      case 'propose_cancel_order':
        return this.proposeCancel(
          stringArg(args, 'orderCode'),
          stringArg(args, 'reason'),
          context,
        );
      default:
        return Promise.resolve({ error: 'unknown_tool' });
    }
  }

  /** Đơn của chính khách; mã sai định dạng hoặc của người khác đều là "không tìm thấy" */
  private findOrder(code: string, customerId: string) {
    const normalized = code.toUpperCase();
    if (!new RegExp(`^${ORDER_CODE_PATTERN.source}$`, 'i').test(normalized)) {
      return null;
    }
    return this.prisma.order.findFirst({
      where: { code: normalized, userId: customerId },
      include: {
        items: { select: { productName: true, quantity: true } },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: HISTORY_ENTRIES,
        },
      },
    });
  }

  private async getOrderStatus(
    code: string,
    { customerId }: ToolContext,
  ): Promise<ToolResult> {
    const order = await this.findOrder(code, customerId);
    if (!order) return { found: false };
    return {
      found: true,
      code: order.code,
      status: order.status,
      statusLabel: STATUS_LABELS[order.status],
      placedAt: formatTime(order.createdAt),
      paidAt: formatTime(order.paidAt),
      cancelledAt: formatTime(order.cancelledAt),
      total: formatMoney(order.totalAmount),
      items: order.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
      })),
      recentHistory: order.statusHistory.map((entry) => ({
        status: STATUS_LABELS[entry.toStatus],
        at: formatTime(entry.createdAt),
        note: entry.note,
      })),
      cancellable: STAFF_CANCELLABLE.includes(order.status),
    };
  }

  private async listRecentOrders({
    customerId,
  }: ToolContext): Promise<ToolResult> {
    const orders = await this.prisma.order.findMany({
      where: { userId: customerId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ORDERS,
      select: { code: true, status: true, createdAt: true, totalAmount: true },
    });
    return {
      orders: orders.map((order) => ({
        code: order.code,
        statusLabel: STATUS_LABELS[order.status],
        placedAt: formatTime(order.createdAt),
        total: formatMoney(order.totalAmount),
      })),
    };
  }

  private async checkInventory(sku: string): Promise<ToolResult> {
    const product = sku
      ? await this.prisma.product.findFirst({
          where: { sku: { equals: sku, mode: 'insensitive' } },
          include: { inventory: true },
        })
      : null;
    if (!product) return { found: false };
    const stock = product.inventory?.stock ?? 0;
    return {
      found: true,
      sku: product.sku,
      name: product.name,
      price: formatMoney(product.price),
      onSale: product.isActive,
      stock,
      inStock: product.isActive && stock > 0,
    };
  }

  /** Chỉ tạo AgentAction PENDING; đơn đã có đề xuất đang chờ thì không tạo thêm */
  private async proposeCancel(
    code: string,
    reason: string,
    context: ToolContext,
  ): Promise<ToolResult> {
    const order = await this.findOrder(code, context.customerId);
    if (!order) return { ok: false, error: 'order_not_found' };
    if (order.status === OrderStatus.CANCELLED) {
      return { ok: false, error: 'already_cancelled' };
    }
    if (!STAFF_CANCELLABLE.includes(order.status)) {
      return {
        ok: false,
        error: 'not_cancellable',
        statusLabel: STATUS_LABELS[order.status],
      };
    }
    const pending = await this.prisma.agentAction.findFirst({
      where: {
        type: CANCEL_ORDER,
        status: AgentActionStatus.PENDING,
        payload: { path: ['orderId'], equals: order.id },
      },
    });
    if (pending) return { ok: true, alreadyPending: true };
    const payload: CancelOrderPayload = {
      orderId: order.id,
      orderCode: order.code,
    };
    await this.prisma.agentAction.create({
      data: {
        ticketId: context.ticketId,
        type: CANCEL_ORDER,
        payload: { ...payload },
        reason: reason.slice(0, 500) || 'Khách yêu cầu huỷ đơn',
      },
    });
    return {
      ok: true,
      status: 'PENDING_STAFF_APPROVAL',
      message: 'Đã gửi đề xuất, đơn CHƯA bị huỷ cho tới khi nhân viên duyệt',
    };
  }
}
