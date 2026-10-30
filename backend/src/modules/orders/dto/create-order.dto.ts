import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../../common/validation/transforms';

export class CreateOrderDto {
  /** @example Nguyễn Văn An */
  @Transform(trim)
  @IsString({ message: 'Tên người nhận không hợp lệ' })
  @MinLength(2, { message: 'Tên người nhận phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Tên người nhận tối đa 100 ký tự' })
  recipientName: string;

  /** @example 0912345678 */
  @Transform(trim)
  @IsString({ message: 'Số điện thoại không hợp lệ' })
  @Matches(/^(0|\+84)\d{9,10}$/, { message: 'Số điện thoại không hợp lệ' })
  recipientPhone: string;

  /** @example 12 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội */
  @Transform(trim)
  @IsString({ message: 'Địa chỉ nhận hàng không hợp lệ' })
  @MinLength(10, { message: 'Địa chỉ nhận hàng phải có ít nhất 10 ký tự' })
  @MaxLength(500, { message: 'Địa chỉ nhận hàng tối đa 500 ký tự' })
  shippingAddress: string;
}
