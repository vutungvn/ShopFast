import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { TooManyRequestsException } from '../../common/rate-limit/too-many-requests.exception';
import { REDIS_CLIENT } from '../../infra/redis/redis.constants';
import { withTimeout } from '../../infra/redis/with-timeout';

/** Cứ sai thêm chừng này lần (tính từ lần khoá trước) thì khoá */
export const FAILURES_PER_LOCK = 5;
/** Số lần sai được quên đi sau 15 phút không sai thêm */
const FAILURE_WINDOW_MS = 15 * 60_000;
/** Sai càng nhiều khoá càng lâu: lần sai thứ 5 => 1 phút, 10 => 5 phút, từ 15 => 15 phút */
const LOCK_STEPS = [
  { failures: 15, ms: 15 * 60_000 },
  { failures: 10, ms: 5 * 60_000 },
  { failures: 5, ms: 60_000 },
];
const LOCKED_REASON = 'Tài khoản tạm khoá do nhập sai mật khẩu nhiều lần';

const COMMAND_TIMEOUT_MS = 100;
const BREAKER_MS = 10_000;
/** Redis lỗi: số email tối đa đếm trong bộ nhớ, để kẻ tấn công không làm đầy bộ nhớ */
const MEMORY_MAX_ENTRIES = 10_000;

interface MemoryEntry {
  failures: number;
  forgetAt: number;
  lockedUntil: number;
}

/**
 * Chống dò mật khẩu: đếm số lần sai theo từng tài khoản bị nhắm (email, kể cả email chưa đăng ký
 * để không lộ email nào có tài khoản), khoá leo thang. Đếm trên Redis để mọi bản API dùng chung;
 * Redis lỗi thì đếm tạm trong bộ nhớ.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly logger = new Logger(LoginAttemptsService.name);
  private readonly memory = new Map<string, MemoryEntry>();
  private brokenUntil = 0;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Đang khoá => 429 kèm thời gian còn lại, không cần kiểm tra mật khẩu */
  async assertNotLocked(email: string): Promise<void> {
    const id = accountId(email);
    const lockMs = await this.redisOr(
      () => this.redis.pttl(lockKey(id)),
      () => this.memoryEntry(id).lockedUntil - Date.now(),
    );
    if (lockMs > 0)
      throw new TooManyRequestsException(LOCKED_REASON, lockMs / 1000);
  }

  /**
   * Ghi một lần sai. Đủ mốc thì khoá và ném 429 ngay;
   * chưa thì trả số lần còn được sai trước khi bị khoá.
   */
  async recordFailure(email: string): Promise<number> {
    const id = accountId(email);
    const failures = await this.redisOr(
      async () => {
        const result = await this.redis
          .multi()
          .incr(failKey(id))
          .pexpire(failKey(id), FAILURE_WINDOW_MS)
          .exec();
        return Number(result?.[0]?.[1]);
      },
      () => {
        const entry = this.memoryEntry(id);
        entry.failures += 1;
        entry.forgetAt = Date.now() + FAILURE_WINDOW_MS;
        return entry.failures;
      },
    );

    if (failures % FAILURES_PER_LOCK !== 0) {
      return FAILURES_PER_LOCK - (failures % FAILURES_PER_LOCK);
    }
    const lockMs = LOCK_STEPS.find((step) => failures >= step.failures)!.ms;
    await this.redisOr<unknown>(
      () => this.redis.set(lockKey(id), '1', 'PX', lockMs),
      () => (this.memoryEntry(id).lockedUntil = Date.now() + lockMs),
    );
    this.logger.warn(
      `Tạm khoá đăng nhập ${maskEmail(email)} ${lockMs / 60_000} phút sau ${failures} lần sai mật khẩu`,
    );
    throw new TooManyRequestsException(LOCKED_REASON, lockMs / 1000);
  }

  /** Đăng nhập đúng: quên các lần sai trước đó */
  async reset(email: string): Promise<void> {
    const id = accountId(email);
    await this.redisOr<unknown>(
      () => this.redis.del(failKey(id)),
      () => this.memory.delete(id),
    );
  }

  private async redisOr<R>(
    command: () => Promise<R>,
    fallback: () => R,
  ): Promise<R> {
    if (Date.now() >= this.brokenUntil) {
      try {
        return await withTimeout(command(), COMMAND_TIMEOUT_MS);
      } catch (err) {
        this.brokenUntil = Date.now() + BREAKER_MS;
        this.logger.warn(
          `Lỗi Redis, đếm đăng nhập sai trong bộ nhớ ${BREAKER_MS / 1000}s: ${(err as Error).message}`,
        );
      }
    }
    return fallback();
  }

  private memoryEntry(id: string): MemoryEntry {
    const now = Date.now();
    let entry = this.memory.get(id);
    if (entry && entry.forgetAt <= now && entry.lockedUntil <= now) {
      this.memory.delete(id);
      entry = undefined;
    }
    if (!entry) {
      if (this.memory.size >= MEMORY_MAX_ENTRIES) {
        // Map giữ thứ tự thêm vào: bỏ email cũ nhất
        this.memory.delete(this.memory.keys().next().value!);
      }
      entry = {
        failures: 0,
        forgetAt: now + FAILURE_WINDOW_MS,
        lockedUntil: 0,
      };
      this.memory.set(id, entry);
    }
    return entry;
  }
}

/** Băm email để không lưu email trong Redis */
function accountId(email: string): string {
  return createHash('sha256')
    .update(email.trim().toLowerCase())
    .digest('hex')
    .slice(0, 32);
}

const failKey = (id: string) => `auth:login-fail:${id}`;
const lockKey = (id: string) => `auth:login-lock:${id}`;

/** khach01@shopfast.vn => kh***@shopfast.vn (log không chứa nguyên email) */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain ?? ''}`;
}
