import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../../common/validation/transforms';

export class CancelOrderDto {
  /**
   * Lý do huỷ (không bắt buộc), lưu vào lịch sử trạng thái
   * @example Tôi muốn đổi địa chỉ nhận hàng
   */
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Lý do huỷ không hợp lệ' })
  @MaxLength(500, { message: 'Lý do huỷ tối đa 500 ký tự' })
  reason?: string;
}
