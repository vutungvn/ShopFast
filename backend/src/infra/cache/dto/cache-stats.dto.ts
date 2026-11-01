export class CacheGroupStatsDto {
  hits: number;
  misses: number;
  /** Tỉ lệ trúng (%), null khi chưa có lượt đọc nào */
  hitRate: number | null;
}

export class CacheStatsDto {
  /** down: Redis đang lỗi, API tạm đọc thẳng DB */
  redis: 'up' | 'down';
  total: CacheGroupStatsDto;
  /** Theo nhóm khoá: pd (chi tiết sản phẩm), pl (danh sách), cat (danh mục), brand (thương hiệu) */
  groups: Record<string, CacheGroupStatsDto>;
}
