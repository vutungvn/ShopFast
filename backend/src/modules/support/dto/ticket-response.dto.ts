import {
  AgentActionStatus,
  MessageSender,
  TicketCategory,
  TicketStatus,
} from '@prisma/client';

export class TicketSummaryDto {
  id: string;
  subject: string;
  category: TicketCategory | null;
  status: TicketStatus;
  orderCode: string | null;
  /** Chỉ nhân viên thấy */
  customerName?: string;
  /** Số đề xuất của AI đang chờ duyệt */
  pendingActions: number;
  createdAt: Date;
  updatedAt: Date;
}

export class TicketMessageResponseDto {
  id: string;
  senderType: MessageSender;
  /** Tên nhân viên / khách; tin AI là null */
  senderName: string | null;
  content: string;
  createdAt: Date;
}

export class TicketActionDto {
  id: string;
  type: string;
  orderCode: string;
  status: AgentActionStatus;
  reason: string | null;
  note: string | null;
  createdAt: Date;
}

export class TicketDetailDto extends TicketSummaryDto {
  orderId: string | null;
  /** Trợ lý AI còn tự trả lời không (tắt khi nhân viên đã tiếp nhận / đã đóng / chưa cấu hình) */
  aiActive: boolean;
  messages: TicketMessageResponseDto[];
  actions: TicketActionDto[];
}
