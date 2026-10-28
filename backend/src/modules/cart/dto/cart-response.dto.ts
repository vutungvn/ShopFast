import { ProductResponseDto } from '../../products/dto/product-response.dto';

/**
 * Vấn đề của một dòng trong giỏ, tính lại mỗi lần xem:
 * INACTIVE – ngừng bán; OUT_OF_STOCK – hết hàng; INSUFFICIENT_STOCK – kho ít hơn số lượng trong giỏ.
 */
export enum CartIssue {
  INACTIVE = 'INACTIVE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
}

export class CartItemResponseDto {
  /** Giá và tồn kho là giá trị hiện tại (giỏ không lưu giá) */
  product: ProductResponseDto;
  quantity: number;
  /** Đơn giá hiện tại × số lượng (VND) */
  lineTotal: number;
  issue: CartIssue | null;
}

export class CartResponseDto {
  /** Thêm sau đứng trước */
  items: CartItemResponseDto[];
  /** Số loại sản phẩm (mọi dòng), dùng cho số đếm trên icon giỏ */
  itemCount: number;
  /** Tổng số lượng của các dòng được tính tiền (không có issue) */
  totalQuantity: number;
  /** Tạm tính, chỉ cộng các dòng không có issue (VND) */
  subtotal: number;
  /** Có ít nhất 1 dòng và không dòng nào có issue */
  canCheckout: boolean;
}
