import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { trim } from '../../../common/validation/transforms';
import { OrderQueryDto } from './order-query.dto';

export const STAFF_ORDER_SORTS = ['newest', 'oldest'] as const;
export type StaffOrderSort = (typeof STAFF_ORDER_SORTS)[number];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class StaffOrderQueryDto extends OrderQueryDto {
  /**
   * Đặt từ ngày (giờ Việt Nam, gồm cả ngày này)
   * @example 2026-10-01
   */
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'from phải có dạng YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'from không phải ngày hợp lệ' })
  from?: string;

  /**
   * Đặt tới ngày (giờ Việt Nam, gồm cả ngày này)
   * @example 2026-10-30
   */
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'to phải có dạng YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'to không phải ngày hợp lệ' })
  to?: string;

  /**
   * Tìm theo một phần mã đơn (không phân biệt hoa thường) hoặc số điện thoại người nhận
   * @example K7QM
   */
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'q không hợp lệ' })
  @MaxLength(50, { message: 'Từ khoá tối đa 50 ký tự' })
  q?: string;

  /** newest: mới nhất trước (mặc định); oldest: cũ nhất trước, dùng cho hàng đợi xử lý */
  @IsOptional()
  @IsIn(STAFF_ORDER_SORTS, { message: 'sort chỉ nhận newest hoặc oldest' })
  sort: StaffOrderSort = 'newest';
}
