import Redis from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  let redis: { eval: jest.Mock };
  let storage: RedisThrottlerStorage;

  beforeEach(() => {
    redis = { eval: jest.fn() };
    storage = new RedisThrottlerStorage(redis as unknown as Redis);
  });

  afterEach(() => jest.restoreAllMocks());

  it('gửi một lệnh Lua với khoá đếm + khoá chặn, đổi thời gian từ ms sang giây', async () => {
    redis.eval.mockResolvedValue([3, 41_200, 0, 0]);

    const record = await storage.increment(
      'default:ip:1.2.3.4',
      60_000,
      300,
      60_000,
      'default',
    );

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      2,
      'rl:default:ip:1.2.3.4',
      'rl:default:ip:1.2.3.4:block',
      60_000,
      300,
      60_000,
    );
    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 42,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('đang bị chặn => isBlocked kèm số giây còn chặn', async () => {
    redis.eval.mockResolvedValue([301, 59_001, 1, 59_001]);
    const record = await storage.increment('k', 60_000, 300, 60_000, 'default');
    expect(record).toMatchObject({ isBlocked: true, timeToBlockExpire: 60 });
  });

  describe('Redis lỗi', () => {
    it('đếm tạm trong bộ nhớ: vẫn chặn khi vượt hạn mức', async () => {
      redis.eval.mockRejectedValue(new Error('Connection is closed'));
      const hit = () => storage.increment('k', 60_000, 2, 60_000, 'default');

      expect((await hit()).isBlocked).toBe(false);
      expect((await hit()).isBlocked).toBe(false);
      expect(await hit()).toMatchObject({ isBlocked: true, totalHits: 3 });
    });

    it('lệnh chậm hơn 100ms => coi như lỗi, đếm trong bộ nhớ', async () => {
      redis.eval.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([1, 1, 0, 0]), 300),
          ),
      );
      const record = await storage.increment('k', 60_000, 5, 60_000, 'default');
      expect(record).toMatchObject({ totalHits: 1, isBlocked: false });
    });

    it('bỏ qua Redis 10s rồi mới thử lại', async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
      redis.eval.mockRejectedValueOnce(new Error('down'));
      await storage.increment('k', 60_000, 5, 60_000, 'default');

      now.mockReturnValue(1_009_999);
      await storage.increment('k', 60_000, 5, 60_000, 'default');
      expect(redis.eval).toHaveBeenCalledTimes(1);

      redis.eval.mockResolvedValue([1, 60_000, 0, 0]);
      now.mockReturnValue(1_010_000);
      await storage.increment('k', 60_000, 5, 60_000, 'default');
      expect(redis.eval).toHaveBeenCalledTimes(2);
    });
  });
});
