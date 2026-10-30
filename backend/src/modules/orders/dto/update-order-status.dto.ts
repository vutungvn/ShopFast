import { OrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../../common/validation/transforms';

export class UpdateOrderStatusDto {
  /**
   * Trạng thái ĐÍCH, phải là bước kế tiếp của trạng thái hiện tại. Hai nhân viên cùng bấm
   * "Xác nhận" thì người sau nhận 409 thay vì đẩy đơn đi thêm một bước.
   * @example CONFIRMED
   */
  @IsEnum(OrderStatus, { message: 'Trạng thái không hợp lệ' })
  status: OrderStatus;

  /** Ghi chú lưu vào lịch sử trạng thái */
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Ghi chú không hợp lệ' })
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;
}
