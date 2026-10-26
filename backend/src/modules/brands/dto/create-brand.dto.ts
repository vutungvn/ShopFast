import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { SLUG_PATTERN } from '../../../common/utils/slug';
import { trim } from '../../../common/validation/transforms';

export class CreateBrandDto {
  /** @example Samsung */
  @Transform(trim)
  @IsString({ message: 'Tên thương hiệu không hợp lệ' })
  @IsNotEmpty({ message: 'Tên thương hiệu không được để trống' })
  @MaxLength(100, { message: 'Tên thương hiệu tối đa 100 ký tự' })
  name: string;

  /**
   * Bỏ trống thì tự sinh từ tên
   * @example samsung
   */
  @IsOptional()
  @Matches(SLUG_PATTERN, {
    message: 'slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang',
  })
  @MaxLength(120, { message: 'slug tối đa 120 ký tự' })
  slug?: string;
}
