import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import Redis from 'ioredis';
import { RedisThrottlerStorage } from '../src/common/rate-limit/redis-throttler.storage';

// Cần Redis đang chạy: docker compose up -d. Kiểm tra script Lua trên Redis thật (unit test chỉ giả lập Redis).
describe('RedisThrottlerStorage – Redis thật (e2e)', () => {
  const RUN = `e2e-${randomUUID().slice(0, 8)}`;
  let redis: Redis;
  let storage: RedisThrottlerStorage;

  beforeAll(async () => {
    if (!process.env.REDIS_URL && existsSync('.env')) {
      process.loadEnvFile('.env');
    }
    redis = new Redis(process.env.REDIS_URL!, { lazyConnect: true });
    await redis.connect();
    storage = new RedisThrottlerStorage(redis);
  });

  afterAll(async () => {
    const keys = await redis.keys(`rl:${RUN}*`);
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
  });

  const hit = (key: string, ttl = 60_000, limit = 3, block = 60_000) =>
    storage.increment(`${RUN}:${key}`, ttl, limit, block, 'default');

  it('đếm trong cửa sổ, đặt hạn sống cho khoá ở lần đầu', async () => {
    expect(await hit('a')).toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect((await hit('a')).totalHits).toBe(2);
    const ttl = await redis.pttl(`rl:${RUN}:a`);
    expect(ttl).toBeGreaterThan(59_000);
    expect(ttl).toBeLessThanOrEqual(60_000);
  });

  it('vượt hạn mức => chặn đúng thời gian chặn, trong lúc chặn không đếm thêm', async () => {
    for (let i = 0; i < 3; i++) await hit('b', 60_000, 3, 5_000);

    expect(await hit('b', 60_000, 3, 5_000)).toEqual({
      totalHits: 4,
      timeToExpire: 5,
      isBlocked: true,
      timeToBlockExpire: 5,
    });
    expect((await hit('b', 60_000, 3, 5_000)).isBlocked).toBe(true);
    expect(await redis.exists(`rl:${RUN}:b`)).toBe(0);
  });

  it('hết thời gian chặn => bắt đầu cửa sổ mới từ 1', async () => {
    for (let i = 0; i < 3; i++) await hit('c', 60_000, 2, 300);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(await hit('c', 60_000, 2, 300)).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
  });

  it('nhiều bản API (nhiều storage) dùng chung một bộ đếm', async () => {
    const other = new RedisThrottlerStorage(redis);
    await hit('d');
    await other.increment(`${RUN}:d`, 60_000, 3, 60_000, 'default');
    expect((await hit('d')).totalHits).toBe(3);
  });

  it('nhiều request đồng thời không đếm sót (lệnh Lua nguyên tử)', async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => hit('e', 60_000, 100)),
    );
    const counts = results.map((r) => r.totalHits).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });
});
