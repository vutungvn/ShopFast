import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { withTimeout } from '../redis/with-timeout';
import { CACHE_PREFIX, clearCacheKeys } from './cache-keys';
import { CacheGroupStatsDto, CacheStatsDto } from './dto/cache-stats.dto';

/** HIT: lấy từ Redis; MISS: đọc DB rồi lưu; BYPASS: Redis đang lỗi nên đọc thẳng DB */
export type CacheStatus = 'HIT' | 'MISS' | 'BYPASS';

export interface Cached<T> {
  value: T;
  status: CacheStatus;
}

export interface CacheOptions<T> {
  /** Nhóm khoá để đếm trúng/trượt, vd 'pd' (chi tiết sản phẩm) */
  group: string;
  /** Thời gian sống (giây) */
  ttl: number;
  /** Kết quả rỗng (không tìm thấy) sống ngắn hơn để dữ liệu mới xuất hiện sớm */
  emptyTtl?: number;
  isEmpty?: (value: T) => boolean;
}

const STATS_KEY = `${CACHE_PREFIX}stats`;
/** Cộng thêm ngẫu nhiên tối đa 10% TTL để các khoá tạo cùng lúc không hết hạn cùng lúc */
const TTL_JITTER = 0.1;
/** Khoá nạp dữ liệu: chỉ một tiến trình xuống DB cho mỗi khoá; tự nhả sau 3s nếu tiến trình đó chết */
const LOCK_TTL_MS = 3000;
/** Không giành được khoá: chờ tối đa chừng này để tiến trình kia ghi cache rồi mới tự đọc DB */
const LOCK_WAIT_MS = 300;
const LOCK_POLL_MS = 50;
/**
 * Lệnh cache chậm hơn 100ms coi như lỗi: đọc DB còn nhanh hơn chờ. Đặt ở đây thay vì `commandTimeout`
 * của client vì client dùng chung (health check, lệnh kiểm tra lúc kết nối) không nên bị giới hạn này.
 */
const COMMAND_TIMEOUT_MS = 100;
/** Lệnh Redis lỗi (mất kết nối, quá thời gian chờ): bỏ qua Redis trong 10s rồi mới thử lại */
const BREAKER_MS = 10_000;

/** Kết quả đọc Redis: chưa có khoá, hoặc Redis đang lỗi */
const MISSING = Symbol('MISSING');
const BROKEN = Symbol('BROKEN');

/**
 * Cache-aside trên Redis. Redis chỉ là lớp tăng tốc: mọi lỗi Redis đều quay về đọc DB,
 * không bao giờ làm request lỗi.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  /** Gộp các lần đọc trùng khoá trong cùng tiến trình thành một lần xuống DB */
  private readonly inflight = new Map<string, Promise<Cached<unknown>>>();
  private brokenUntil = 0;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getOrSet<T>(
    key: string,
    options: CacheOptions<T>,
    load: () => Promise<T>,
  ): Promise<Cached<T>> {
    if (this.isBroken()) return { value: await load(), status: 'BYPASS' };

    const pending = this.inflight.get(key) as Promise<Cached<T>> | undefined;
    if (pending) return pending;
    const task = this.fetch(key, options, load).finally(() =>
      this.inflight.delete(key),
    );
    this.inflight.set(key, task);
    return task;
  }

  /** Số nguyên lưu trong cache (vd phiên bản danh sách), chưa có hoặc Redis lỗi => 0 */
  async getNumber(key: string): Promise<number> {
    const raw = await this.run((r) => r.get(CACHE_PREFIX + key));
    return typeof raw === 'string' ? Number(raw) || 0 : 0;
  }

  // Lệnh làm mới cache vẫn thử dù đang ngắt Redis: bỏ sót thì khách thấy dữ liệu cũ tới hết TTL
  async increment(key: string): Promise<void> {
    await this.run((r) => r.incr(CACHE_PREFIX + key), { force: true });
  }

  async delete(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.run((r) => r.del(...keys.map((k) => CACHE_PREFIX + k)), {
      force: true,
    });
  }

  /** Xoá toàn bộ cache và số đếm; trả về số khoá đã xoá */
  async clear(): Promise<number> {
    // SCAN cả cache có thể lâu hơn giới hạn một lệnh
    const deleted = await this.run((r) => clearCacheKeys(r), {
      force: true,
      noTimeout: true,
    });
    return deleted === BROKEN ? 0 : deleted;
  }

  async stats(): Promise<CacheStatsDto> {
    const raw = await this.run((r) => r.hgetall(STATS_KEY));
    const counts = raw === BROKEN ? {} : raw;
    const groups: Record<string, CacheGroupStatsDto> = {};
    let hits = 0;
    let misses = 0;
    for (const [field, value] of Object.entries(counts)) {
      const [group, kind] = field.split(':');
      const g = (groups[group] ??= { hits: 0, misses: 0, hitRate: null });
      if (kind === 'hit') g.hits += Number(value);
      else g.misses += Number(value);
    }
    for (const g of Object.values(groups)) {
      g.hitRate = hitRate(g.hits, g.misses);
      hits += g.hits;
      misses += g.misses;
    }
    return {
      redis: this.isBroken() ? 'down' : 'up',
      total: { hits, misses, hitRate: hitRate(hits, misses) },
      groups,
    };
  }

  private async fetch<T>(
    key: string,
    options: CacheOptions<T>,
    load: () => Promise<T>,
  ): Promise<Cached<T>> {
    const fullKey = CACHE_PREFIX + key;
    const cached = await this.read<T>(fullKey);
    if (cached === BROKEN) return { value: await load(), status: 'BYPASS' };
    if (cached !== MISSING) {
      this.count(options.group, 'hit');
      return { value: cached, status: 'HIT' };
    }
    this.count(options.group, 'miss');

    const lockKey = `${CACHE_PREFIX}lock:${key}`;
    const locked = await this.run((r) =>
      r.set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX'),
    );
    if (locked !== 'OK') {
      // Tiến trình khác đang nạp (hoặc Redis vừa lỗi): chờ nó ghi, quá hạn thì tự đọc DB
      if (locked !== BROKEN) {
        const waited = await this.waitFor<T>(fullKey);
        if (waited !== MISSING) return { value: waited, status: 'HIT' };
      }
      return { value: await load(), status: 'MISS' };
    }

    try {
      const value = await load();
      const empty = options.isEmpty?.(value) ?? value === null;
      const ttl = empty ? (options.emptyTtl ?? options.ttl) : options.ttl;
      await this.run((r) =>
        r.set(fullKey, JSON.stringify(value), 'PX', jitteredMs(ttl)),
      );
      return { value, status: 'MISS' };
    } finally {
      await this.run((r) => r.del(lockKey));
    }
  }

  private async read<T>(
    fullKey: string,
  ): Promise<T | typeof MISSING | typeof BROKEN> {
    const raw = await this.run((r) => r.get(fullKey));
    if (raw === BROKEN) return BROKEN;
    return raw === null ? MISSING : (JSON.parse(raw) as T);
  }

  private async waitFor<T>(fullKey: string): Promise<T | typeof MISSING> {
    for (let waited = 0; waited < LOCK_WAIT_MS; waited += LOCK_POLL_MS) {
      await delay(LOCK_POLL_MS);
      const value = await this.read<T>(fullKey);
      if (value === BROKEN) return MISSING;
      if (value !== MISSING) return value;
    }
    return MISSING;
  }

  /** Đếm trúng/trượt: không chờ, lỗi thì bỏ qua */
  private count(group: string, kind: 'hit' | 'miss') {
    void this.run((r) => r.hincrby(STATS_KEY, `${group}:${kind}`, 1));
  }

  private isBroken(): boolean {
    return Date.now() < this.brokenUntil;
  }

  /**
   * Chạy lệnh Redis; lỗi hoặc quá thời gian chờ thì ngắt Redis trong BREAKER_MS và trả BROKEN thay vì ném lỗi.
   * `force`: vẫn chạy khi đang ngắt (lệnh làm mới cache).
   */
  private async run<R>(
    command: (redis: Redis) => Promise<R>,
    { force = false, noTimeout = false } = {},
  ): Promise<R | typeof BROKEN> {
    if (!force && this.isBroken()) return BROKEN;
    try {
      const pending = command(this.redis);
      return await (noTimeout
        ? pending
        : withTimeout(pending, COMMAND_TIMEOUT_MS));
    } catch (err) {
      this.brokenUntil = Date.now() + BREAKER_MS;
      this.logger.warn(
        `Lỗi Redis, đọc thẳng DB trong ${BREAKER_MS / 1000}s: ${(err as Error).message}`,
      );
      return BROKEN;
    }
  }
}

function jitteredMs(ttlSeconds: number): number {
  return Math.round(ttlSeconds * 1000 * (1 + Math.random() * TTL_JITTER));
}

function hitRate(hits: number, misses: number): number | null {
  const total = hits + misses;
  return total === 0 ? null : Math.round((hits / total) * 1000) / 10;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
