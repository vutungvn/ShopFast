import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AgentActionStatus, OrderStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { trim } from '../../../common/validation/transforms';

export class AgentActionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AgentActionStatus, { message: 'Trạng thái không hợp lệ' })
  status?: AgentActionStatus;
}

export class RejectActionDto {
  /** @example Đơn đã đóng gói xong, liên hệ khách để giao */
  @Transform(trim)
  @IsString({ message: 'Lý do không hợp lệ' })
  @MinLength(5, { message: 'Lý do từ chối ít nhất 5 ký tự' })
  @MaxLength(500, { message: 'Lý do từ chối tối đa 500 ký tự' })
  reason: string;
}

export class AgentActionDto {
  id: string;
  /** Hiện chỉ có CANCEL_ORDER */
  type: string;
  status: AgentActionStatus;
  /** Lý do AI ghi lại từ lời khách */
  reason: string | null;
  /** Lý do từ chối hoặc lỗi khi thực thi */
  note: string | null;
  orderId: string;
  orderCode: string;
  /** Trạng thái hiện tại của đơn (null nếu không còn tìm thấy) */
  orderStatus: OrderStatus | null;
  ticketId: string;
  ticketSubject: string;
  customerName: string;
  reviewerName: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}
