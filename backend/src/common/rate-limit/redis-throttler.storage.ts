import { Logger } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import Redis from 'ioredis';
import { withTimeout } from '../../infra/redis/with-timeout';

// Gói không export kiểu này ra ngoài
type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

const KEY_PREFIX = 'rl:';
/** Redis chậm hơn mức này thì đếm tạm trong bộ nhớ, không để request chờ */
const COMMAND_TIMEOUT_MS = 100;
/** Redis lỗi: đếm trong bộ nhớ 10s rồi mới thử lại Redis */
const BREAKER_MS = 10_000;

/**
 * Đếm theo cửa sổ cố định, một lệnh duy nhất nên nhiều bản API cùng đếm không bị sai.
 * KEYS[1]: số lần gọi trong cửa sổ; KEYS[2]: đang bị chặn.
 * ARGV: độ dài cửa sổ (ms), hạn mức, thời gian chặn (ms).
 * Trả về {số lần gọi, ms tới khi cửa sổ hết, đang chặn (0/1), ms tới khi hết chặn}.
 */
const HIT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  return {tonumber(ARGV[2]) + 1, blockTtl, 1, blockTtl}
end
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
if hits <= tonumber(ARGV[2]) then
  return {hits, ttl, 0, 0}
end
local block = tonumber(ARGV[3])
if block <= 0 then
  return {hits, ttl, 1, ttl}
end
redis.call('SET', KEYS[2], '1', 'PX', block)
redis.call('DEL', KEYS[1])
return {hits, block, 1, block}
`;

/**
 * Lưu bộ đếm rate limit trên Redis để mọi bản API dùng chung.
 * Redis lỗi thì đếm tạm trong bộ nhớ từng tiến trình: vẫn chặn được lạm dụng, chỉ kém chính xác hơn.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly memory = new ThrottlerStorageService();
  private brokenUntil = 0;

  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (Date.now() >= this.brokenUntil) {
      try {
        const [hits, ttlMs, blocked, blockMs] = (await withTimeout(
          this.redis.eval(
            HIT_SCRIPT,
            2,
            `${KEY_PREFIX}${key}`,
            `${KEY_PREFIX}${key}:block`,
            ttl,
            limit,
            blockDuration,
          ),
          COMMAND_TIMEOUT_MS,
        )) as number[];
        return {
          totalHits: hits,
          timeToExpire: toSeconds(ttlMs),
          isBlocked: blocked === 1,
          timeToBlockExpire: toSeconds(blockMs),
        };
      } catch (err) {
        this.brokenUntil = Date.now() + BREAKER_MS;
        this.logger.warn(
          `Lỗi Redis, đếm rate limit trong bộ nhớ ${BREAKER_MS / 1000}s: ${(err as Error).message}`,
        );
      }
    }
    return this.memory.increment(key, ttl, limit, blockDuration, throttlerName);
  }
}

/** Thư viện tính thời gian theo giây (header Retry-After, X-RateLimit-Reset) */
const toSeconds = (ms: number) => Math.ceil(ms / 1000);
