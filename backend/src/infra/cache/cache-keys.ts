import type Redis from 'ioredis';

/** Mọi khoá cache nằm dưới tiền tố này để xoá cache không đụng dữ liệu khác trong Redis */
export const CACHE_PREFIX = 'cache:';

/** Xoá toàn bộ khoá cache (kể cả số đếm trúng/trượt), trả về số khoá đã xoá. Dùng SCAN để không chặn Redis. */
export async function clearCacheKeys(redis: Redis): Promise<number> {
  let cursor = '0';
  let deleted = 0;
  do {
    const [next, keys] = await redis.scan(
      cursor,
      'MATCH',
      `${CACHE_PREFIX}*`,
      'COUNT',
      500,
    );
    cursor = next;
    if (keys.length > 0) deleted += await redis.unlink(...keys);
  } while (cursor !== '0');
  return deleted;
}
