import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SLUG_PATTERN } from '../../../common/utils/slug';
import { trim } from '../../../common/validation/transforms';

/** Giới hạn của cột DECIMAL(12, 2) */
export const MAX_PRICE = 9_999_999_999.99;
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

export const toUpperSku = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateProductDto {
  /**
   * Mã sản phẩm, tự chuyển chữ hoa
   * @example SS-S24-256
   */
  @Transform(toUpperSku)
  @IsString({ message: 'SKU không hợp lệ' })
  @Matches(SKU_PATTERN, { message: 'SKU chỉ gồm chữ, số và dấu gạch ngang' })
  @MaxLength(50, { message: 'SKU tối đa 50 ký tự' })
  sku: string;

  /** @example Điện thoại Samsung Galaxy S24 256GB */
  @Transform(trim)
  @IsString({ message: 'Tên sản phẩm không hợp lệ' })
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  @MaxLength(200, { message: 'Tên sản phẩm tối đa 200 ký tự' })
  name: string;

  /** Bỏ trống thì tự sinh từ tên */
  @IsOptional()
  @Matches(SLUG_PATTERN, {
    message: 'slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang',
  })
  @MaxLength(220, { message: 'slug tối đa 220 ký tự' })
  slug?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Mô tả không hợp lệ' })
  @MaxLength(5000, { message: 'Mô tả tối đa 5000 ký tự' })
  description?: string;

  /**
   * Giá bán (VND)
   * @example 22990000
   */
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Giá phải là số' })
  @IsPositive({ message: 'Giá phải lớn hơn 0' })
  @Max(MAX_PRICE, { message: 'Giá vượt quá giới hạn' })
  price: number;

  @IsUUID('4', { message: 'categoryId không hợp lệ' })
  categoryId: string;

  @IsUUID('4', { message: 'brandId không hợp lệ' })
  brandId: string;

  /** Tồn kho ban đầu, mặc định 0 */
  @IsOptional()
  @IsInt({ message: 'Tồn kho phải là số nguyên' })
  @Min(0, { message: 'Tồn kho không được âm' })
  @Max(1_000_000, { message: 'Tồn kho tối đa 1.000.000' })
  stock: number = 0;

  /** Đang bán; mặc định true */
  @IsOptional()
  @IsBoolean({ message: 'isActive phải là true hoặc false' })
  isActive: boolean = true;
}
