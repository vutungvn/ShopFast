import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { toBoolean, toStringList } from '../../../common/validation/transforms';

export enum ProductSort {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NAME_ASC = 'name_asc',
}

export class ProductQueryDto extends PaginationQueryDto {
  /**
   * Slug danh mục; gồm cả sản phẩm thuộc danh mục con
   * @example dien-thoai
   */
  @IsOptional()
  @IsString({ message: 'category không hợp lệ' })
  @MaxLength(120, { message: 'category không hợp lệ' })
  category?: string;

  /**
   * Một hoặc nhiều slug thương hiệu: `brand=apple,samsung` hoặc `brand=apple&brand=samsung`
   * @example apple,samsung
   */
  @IsOptional()
  @Transform(toStringList)
  @IsArray({ message: 'brand không hợp lệ' })
  @ArrayMaxSize(20, { message: 'Lọc tối đa 20 thương hiệu' })
  @IsString({ each: true, message: 'brand không hợp lệ' })
  brand?: string[];

  /** Giá thấp nhất (bao gồm) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'minPrice phải là số' })
  @Min(0, { message: 'minPrice không được âm' })
  minPrice?: number;

  /** Giá cao nhất (bao gồm) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'maxPrice phải là số' })
  @Min(0, { message: 'maxPrice không được âm' })
  maxPrice?: number;

  /** true: chỉ sản phẩm còn hàng; false: chỉ sản phẩm hết hàng */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'inStock phải là true hoặc false' })
  inStock?: boolean;

  /** Tìm theo tên (không phân biệt hoa thường) hoặc đúng mã SKU */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString({ message: 'q không hợp lệ' })
  @MaxLength(100, { message: 'q tối đa 100 ký tự' })
  q?: string;

  /** Thứ tự sắp xếp, mặc định mới nhất trước */
  @IsOptional()
  @IsEnum(ProductSort, {
    message: 'sort phải là newest, price_asc, price_desc hoặc name_asc',
  })
  sort: ProductSort = ProductSort.NEWEST;
}

/** Bộ lọc cho nhân viên: thấy cả sản phẩm đã ngừng bán. */
export class ManageProductQueryDto extends ProductQueryDto {
  /** Lọc theo trạng thái bán; bỏ trống => tất cả */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isActive phải là true hoặc false' })
  isActive?: boolean;

  /** true => chỉ sản phẩm sắp hết (còn 1–5) để lên kế hoạch nhập hàng */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'lowStock phải là true hoặc false' })
  lowStock?: boolean;
}
