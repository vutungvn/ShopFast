import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { SLUG_PATTERN } from '../../../common/utils/slug';
import { trim } from '../../../common/validation/transforms';

export class CreateCategoryDto {
  /** @example Điện thoại */
  @Transform(trim)
  @IsString({ message: 'Tên danh mục không hợp lệ' })
  @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
  @MaxLength(100, { message: 'Tên danh mục tối đa 100 ký tự' })
  name: string;

  /**
   * Bỏ trống thì tự sinh từ tên
   * @example dien-thoai
   */
  @IsOptional()
  @Matches(SLUG_PATTERN, {
    message: 'slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang',
  })
  @MaxLength(120, { message: 'slug tối đa 120 ký tự' })
  slug?: string;

  /** Danh mục cha; bỏ trống => danh mục gốc */
  @IsOptional()
  @IsUUID('4', { message: 'parentId không hợp lệ' })
  parentId?: string;
}
