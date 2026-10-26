import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { SLUG_PATTERN } from '../../../common/utils/slug';
import { IsOptionalNonNull, trim } from '../../../common/validation/transforms';

/** Chỉ cập nhật các field được gửi. Đổi tên không tự đổi slug để giữ URL cũ. */
export class UpdateBrandDto {
  @IsOptionalNonNull()
  @Transform(trim)
  @IsString({ message: 'Tên thương hiệu không hợp lệ' })
  @IsNotEmpty({ message: 'Tên thương hiệu không được để trống' })
  @MaxLength(100, { message: 'Tên thương hiệu tối đa 100 ký tự' })
  name?: string;

  @IsOptionalNonNull()
  @Matches(SLUG_PATTERN, {
    message: 'slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang',
  })
  @MaxLength(120, { message: 'slug tối đa 120 ký tự' })
  slug?: string;
}
