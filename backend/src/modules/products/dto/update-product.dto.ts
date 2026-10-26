import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
} from 'class-validator';
import { SLUG_PATTERN } from '../../../common/utils/slug';
import { IsOptionalNonNull, trim } from '../../../common/validation/transforms';
import { MAX_PRICE, SKU_PATTERN, toUpperSku } from './create-product.dto';

/**
 * Chỉ cập nhật các field được gửi. Tồn kho không sửa ở đây (thuộc nghiệp vụ kho).
 * Ngừng bán: `{ "isActive": false }` – sản phẩm không bị xoá vì đơn hàng cũ còn tham chiếu.
 */
export class UpdateProductDto {
  @IsOptionalNonNull()
  @Transform(toUpperSku)
  @IsString({ message: 'SKU không hợp lệ' })
  @Matches(SKU_PATTERN, { message: 'SKU chỉ gồm chữ, số và dấu gạch ngang' })
  @MaxLength(50, { message: 'SKU tối đa 50 ký tự' })
  sku?: string;

  @IsOptionalNonNull()
  @Transform(trim)
  @IsString({ message: 'Tên sản phẩm không hợp lệ' })
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  @MaxLength(200, { message: 'Tên sản phẩm tối đa 200 ký tự' })
  name?: string;

  @IsOptionalNonNull()
  @Matches(SLUG_PATTERN, {
    message: 'slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang',
  })
  @MaxLength(220, { message: 'slug tối đa 220 ký tự' })
  slug?: string;

  /** `null` => xoá mô tả */
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Mô tả không hợp lệ' })
  @MaxLength(5000, { message: 'Mô tả tối đa 5000 ký tự' })
  description?: string | null;

  @IsOptionalNonNull()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Giá phải là số' })
  @IsPositive({ message: 'Giá phải lớn hơn 0' })
  @Max(MAX_PRICE, { message: 'Giá vượt quá giới hạn' })
  price?: number;

  @IsOptionalNonNull()
  @IsUUID('4', { message: 'categoryId không hợp lệ' })
  categoryId?: string;

  @IsOptionalNonNull()
  @IsUUID('4', { message: 'brandId không hợp lệ' })
  brandId?: string;

  @IsOptionalNonNull()
  @IsBoolean({ message: 'isActive phải là true hoặc false' })
  isActive?: boolean;
}
