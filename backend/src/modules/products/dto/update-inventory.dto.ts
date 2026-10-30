import { IsInt, IsOptional, Max, Min, NotEquals } from 'class-validator';

export const MAX_STOCK = 1_000_000;

/**
 * Gửi ĐÚNG MỘT trong hai:
 * - `stock`: đặt lại số tồn (kiểm kê thực tế)
 * - `delta`: cộng (nhập hàng) / trừ (xuất hỏng, thất lạc) so với số hiện tại
 *
 * Nhập/xuất hằng ngày nên dùng `delta`: phép cộng chạy nguyên tử trên DB nên không đè mất
 * phần kho vừa bị trừ bởi đơn đặt cùng lúc; `stock` thì ghi đè đúng con số gửi lên.
 */
export class UpdateInventoryDto {
  /** @example 120 */
  @IsOptional()
  @IsInt({ message: 'stock phải là số nguyên' })
  @Min(0, { message: 'stock không được âm' })
  @Max(MAX_STOCK, { message: `stock tối đa ${MAX_STOCK}` })
  stock?: number;

  /** @example -3 */
  @IsOptional()
  @IsInt({ message: 'delta phải là số nguyên' })
  @NotEquals(0, { message: 'delta phải khác 0' })
  @Min(-MAX_STOCK, { message: `delta tối thiểu -${MAX_STOCK}` })
  @Max(MAX_STOCK, { message: `delta tối đa ${MAX_STOCK}` })
  delta?: number;
}
