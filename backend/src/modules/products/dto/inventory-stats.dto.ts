export class InventoryStatsDto {
  /** Mọi sản phẩm, gồm cả ngừng bán */
  total: number;
  /** Đang bán, còn 1..LOW_STOCK_THRESHOLD */
  lowStock: number;
  /** Đang bán, hết hàng */
  outOfStock: number;
  /** Ngừng bán */
  inactive: number;
}
