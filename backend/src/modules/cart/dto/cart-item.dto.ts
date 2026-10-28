import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { MAX_QUANTITY_PER_ITEM } from '../cart.constants';

export class UpdateCartItemDto {
  /**
   * Số lượng mới (đặt lại, không cộng dồn). Muốn bỏ sản phẩm thì dùng DELETE
   * @example 2
   */
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Max(MAX_QUANTITY_PER_ITEM, {
    message: `Tối đa ${MAX_QUANTITY_PER_ITEM} sản phẩm mỗi loại`,
  })
  quantity: number;
}

export class AddCartItemDto extends UpdateCartItemDto {
  @IsUUID('4', { message: 'productId không hợp lệ' })
  productId: string;
}
