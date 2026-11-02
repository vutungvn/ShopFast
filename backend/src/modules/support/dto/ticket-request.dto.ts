import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TicketCategory, TicketStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  IsOptionalNonNull,
  toBoolean,
  trim,
} from '../../../common/validation/transforms';

const MAX_MESSAGE = 1000;

export class CreateTicketDto {
  /**
   * Tiêu đề ngắn
   * @example Đơn của tôi bao giờ tới?
   */
  @Transform(trim)
  @IsString({ message: 'Tiêu đề không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề' })
  @MaxLength(150, { message: 'Tiêu đề tối đa 150 ký tự' })
  subject: string;

  /**
   * Nội dung cần hỗ trợ
   * @example Tôi đặt đơn SF-261101-K7QM hôm qua, khi nào giao?
   */
  @Transform(trim)
  @IsString({ message: 'Nội dung không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung' })
  @MaxLength(MAX_MESSAGE, {
    message: `Nội dung tối đa ${MAX_MESSAGE} ký tự`,
  })
  message: string;

  /** Đơn liên quan (của chính khách) */
  @IsOptional()
  @IsUUID('4', { message: 'Mã đơn không hợp lệ' })
  orderId?: string;
}

export class TicketMessageDto {
  /** @example Đơn đó tôi muốn huỷ vì đặt nhầm màu */
  @Transform(trim)
  @IsString({ message: 'Nội dung không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung' })
  @MaxLength(MAX_MESSAGE, {
    message: `Nội dung tối đa ${MAX_MESSAGE} ký tự`,
  })
  content: string;
}

export class UpdateTicketDto {
  @IsOptionalNonNull()
  @IsEnum(TicketStatus, { message: 'Trạng thái không hợp lệ' })
  status?: TicketStatus;

  @IsOptionalNonNull()
  @IsEnum(TicketCategory, { message: 'Nhóm không hợp lệ' })
  category?: TicketCategory;
}

export class TicketQueryDto extends PaginationQueryDto {
  /** Lọc theo trạng thái (nhân viên) */
  @IsOptional()
  @IsEnum(TicketStatus, { message: 'Trạng thái không hợp lệ' })
  status?: TicketStatus;

  /** Lọc theo nhóm (nhân viên) */
  @IsOptional()
  @IsEnum(TicketCategory, { message: 'Nhóm không hợp lệ' })
  category?: TicketCategory;

  /** Chỉ yêu cầu gắn với đơn này (nút hỗ trợ trên trang chi tiết đơn) */
  @IsOptional()
  @IsUUID('4', { message: 'Mã đơn không hợp lệ' })
  orderId?: string;

  /** true: chỉ yêu cầu còn mở (Mới / Đang xử lý), để mở lại cuộc trò chuyện thay vì tạo mới */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'open phải là true hoặc false' })
  open?: boolean;
}
