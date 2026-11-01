/**
 * Xoá toàn bộ cache khi dữ liệu bị sửa ngoài API (seed, sửa tay trong DB):
 *   npm run cache:clear
 * Seed tự gọi ở cuối nên chạy seed xong không cần chạy lại.
 */
import { existsSync } from 'node:fs';
import Redis from 'ioredis';
import { clearCacheKeys } from './cache-keys';

export async function clearCache(): Promise<number> {
  // Chạy ngoài Nest nên không có ConfigModule nạp .env
  if (!process.env.REDIS_URL && existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('Thiếu REDIS_URL');

  const redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();
    return await clearCacheKeys(redis);
  } finally {
    redis.disconnect();
  }
}

if (require.main === module) {
  clearCache()
    .then((deleted) => console.log(`Đã xoá ${deleted} khoá cache.`))
    .catch((err: Error) => {
      console.error(`Không xoá được cache: ${err.message}`);
      process.exitCode = 1;
    });
}
