import Redis from 'ioredis';
import { CacheService } from './cache.service';

/** Redis giả trong bộ nhớ: đủ các lệnh CacheService dùng, có hạn sống theo PX */
class FakeRedis {
  readonly store = new Map<string, { value: string; expiresAt?: number }>();
  readonly hashes = new Map<string, Map<string, number>>();
  /** Gán để giả lập Redis lỗi */
  failure: Error | null = null;

  get = jest.fn(async (key: string) => {
    this.check();
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  });

  set = jest.fn(async (key: string, value: string, ...args: unknown[]) => {
    this.check();
    const pxIndex = args.indexOf('PX');
    const px = pxIndex >= 0 ? Number(args[pxIndex + 1]) : undefined;
    if (args.includes('NX') && (await this.get(key)) !== null) return null;
    this.store.set(key, {
      value,
      expiresAt: px === undefined ? undefined : Date.now() + px,
    });
    return 'OK';
  });

  del = jest.fn(async (...keys: string[]) => {
    this.check();
    return keys.filter((k) => this.store.delete(k)).length;
  });

  unlink = this.del;

  incr = jest.fn(async (key: string) => {
    this.check();
    const next = Number((await this.get(key)) ?? 0) + 1;
    this.store.set(key, { value: String(next) });
    return next;
  });

  hincrby = jest.fn(async (key: string, field: string, by: number) => {
    this.check();
    const hash = this.hashes.get(key) ?? new Map<string, number>();
    hash.set(field, (hash.get(field) ?? 0) + by);
    this.hashes.set(key, hash);
    return hash.get(field);
  });

  hgetall = jest.fn(async (key: string) => {
    this.check();
    return Object.fromEntries(
      [...(this.hashes.get(key) ?? new Map<string, number>())].map(([f, v]) => [
        f,
        String(v),
      ]),
    );
  });

  /** Trả hết khoá khớp tiền tố trong một lượt (pattern dạng `tiền-tố*`) */
  scan = jest.fn(async (_cursor: string, _match: string, pattern: string) => {
    this.check();
    const prefix = pattern.replace(/\*$/, '');
    const keys = [...this.store.keys(), ...this.hashes.keys()].filter((k) =>
      k.startsWith(prefix),
    );
    return ['0', keys];
  });

  private check() {
    if (this.failure) throw this.failure;
  }
}

const options = { group: 'pd', ttl: 600, emptyTtl: 30 };

describe('CacheService', () => {
  let redis: FakeRedis;
  let cache: CacheService;

  beforeEach(() => {
    redis = new FakeRedis();
    // del cũng xoá hash để stats bị xoá theo khi clear
    const del = redis.del.getMockImplementation()!;
    redis.del.mockImplementation(async (...keys: string[]) => {
      const removed = keys.filter((k) => redis.hashes.delete(k)).length;
      return (await del(...keys)) + removed;
    });
    cache = new CacheService(redis as unknown as Redis);
  });

  afterEach(() => jest.restoreAllMocks());

  /** Ghi cache chạy nền sau khi trả kết quả: chờ các promise đang treo xong */
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  describe('getOrSet', () => {
    it('lần đầu MISS đọc nguồn, lần sau HIT không đọc lại', async () => {
      const load = jest.fn(async () => ({ id: 'p1', price: 100 }));

      const first = await cache.getOrSet('pd:a', options, load);
      const second = await cache.getOrSet('pd:a', options, load);

      expect(first).toEqual({
        value: { id: 'p1', price: 100 },
        status: 'MISS',
      });
      expect(second).toEqual({
        value: { id: 'p1', price: 100 },
        status: 'HIT',
      });
      expect(load).toHaveBeenCalledTimes(1);
      expect(redis.store.has('cache:pd:a')).toBe(true);
    });

    it('TTL cộng ngẫu nhiên tối đa 10%', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      await cache.getOrSet('pd:a', options, async () => 1);
      expect(redis.set).toHaveBeenCalledWith('cache:pd:a', '1', 'PX', 630_000);
    });

    it('kết quả rỗng (null) được cache với TTL ngắn, lần sau không xuống nguồn', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const load = jest.fn(async () => null);

      await cache.getOrSet('pd:khong-co', options, load);
      const again = await cache.getOrSet('pd:khong-co', options, load);

      expect(redis.set).toHaveBeenCalledWith(
        'cache:pd:khong-co',
        'null',
        'PX',
        30_000,
      );
      expect(again).toEqual({ value: null, status: 'HIT' });
      expect(load).toHaveBeenCalledTimes(1);
    });

    it('isEmpty tuỳ chỉnh quyết định TTL ngắn', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      await cache.getOrSet(
        'pl:x',
        { ...options, isEmpty: (v: number[]) => v.length === 0 },
        async () => [],
      );
      expect(redis.set).toHaveBeenCalledWith('cache:pl:x', '[]', 'PX', 30_000);
    });

    it('nhiều request cùng khoá trong một tiến trình => chỉ một lần xuống nguồn', async () => {
      const load = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('v'), 20)),
      );
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          cache.getOrSet('pd:hot', options, load),
        ),
      );
      expect(load).toHaveBeenCalledTimes(1);
      expect(results.every((r) => r.value === 'v')).toBe(true);
    });

    it('tiến trình khác đang giữ khoá nạp => chờ nó ghi rồi đọc cache, không xuống nguồn', async () => {
      await redis.set('cache:lock:pd:hot', '1', 'PX', 3000);
      setTimeout(() => void redis.set('cache:pd:hot', '"v"'), 80);
      const load = jest.fn(async () => 'tu-db');

      const res = await cache.getOrSet('pd:hot', options, load);

      expect(res).toEqual({ value: 'v', status: 'HIT' });
      expect(load).not.toHaveBeenCalled();
    });

    it('chờ quá 300ms mà tiến trình kia chưa ghi => tự đọc nguồn', async () => {
      await redis.set('cache:lock:pd:hot', '1', 'PX', 3000);
      const load = jest.fn(async () => 'tu-db');
      const started = Date.now();

      const res = await cache.getOrSet('pd:hot', options, load);

      expect(res).toEqual({ value: 'tu-db', status: 'MISS' });
      expect(Date.now() - started).toBeGreaterThanOrEqual(250);
    });

    it('nguồn lỗi => ném lỗi, không cache, nhả khoá nạp', async () => {
      await expect(
        cache.getOrSet('pd:a', options, async () => {
          throw new Error('db down');
        }),
      ).rejects.toThrow('db down');
      expect(redis.store.has('cache:pd:a')).toBe(false);
      expect(redis.store.has('cache:lock:pd:a')).toBe(false);
    });
  });

  describe('Redis lỗi', () => {
    it('đọc thẳng nguồn (BYPASS), không ném lỗi', async () => {
      redis.failure = new Error('Command timed out');
      const res = await cache.getOrSet('pd:a', options, async () => 'tu-db');
      expect(res).toEqual({ value: 'tu-db', status: 'BYPASS' });
    });

    it('lệnh chậm hơn 100ms => coi như lỗi, đọc thẳng nguồn', async () => {
      redis.get.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve('"cu"'), 300)),
      );
      const res = await cache.getOrSet('pd:a', options, async () => 'tu-db');
      expect(res).toEqual({ value: 'tu-db', status: 'BYPASS' });
    });

    it('ngắt Redis 10s: không gọi Redis nữa, hết 10s thì thử lại', async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
      redis.failure = new Error('Connection is closed');
      await cache.getOrSet('pd:a', options, async () => 1);
      const calls = redis.get.mock.calls.length;

      redis.failure = null;
      now.mockReturnValue(1_009_000);
      expect(
        (await cache.getOrSet('pd:a', options, async () => 1)).status,
      ).toBe('BYPASS');
      expect(redis.get.mock.calls.length).toBe(calls);
      expect((await cache.stats()).redis).toBe('down');

      now.mockReturnValue(1_010_001);
      expect(
        (await cache.getOrSet('pd:a', options, async () => 1)).status,
      ).toBe('MISS');
      expect((await cache.stats()).redis).toBe('up');
    });

    it('lệnh làm mới (xoá khoá, tăng phiên bản) vẫn thử dù đang ngắt', async () => {
      redis.failure = new Error('down');
      await cache.getOrSet('pd:a', options, async () => 1);
      redis.failure = null;

      await redis.set('cache:pd:a', '1');
      await cache.delete('pd:a');
      await cache.increment('pl:ver');

      expect(redis.store.has('cache:pd:a')).toBe(false);
      expect(redis.store.get('cache:pl:ver')?.value).toBe('1');
    });

    it('getNumber khi Redis lỗi => 0', async () => {
      redis.failure = new Error('down');
      expect(await cache.getNumber('pl:ver')).toBe(0);
    });
  });

  it('getNumber / increment: phiên bản bắt đầu từ 0', async () => {
    expect(await cache.getNumber('pl:ver')).toBe(0);
    await cache.increment('pl:ver');
    await cache.increment('pl:ver');
    expect(await cache.getNumber('pl:ver')).toBe(2);
  });

  it('stats: đếm trúng/trượt theo nhóm và tổng, tỉ lệ trúng theo %', async () => {
    const pl = { group: 'pl', ttl: 120 };
    await cache.getOrSet('pd:a', options, async () => 1);
    await cache.getOrSet('pd:a', options, async () => 1);
    await cache.getOrSet('pd:a', options, async () => 1);
    await cache.getOrSet('pl:x', pl, async () => 1);
    await flush();

    expect(await cache.stats()).toEqual({
      redis: 'up',
      total: { hits: 2, misses: 2, hitRate: 50 },
      groups: {
        pd: { hits: 2, misses: 1, hitRate: 66.7 },
        pl: { hits: 0, misses: 1, hitRate: 0 },
      },
    });
  });

  it('stats khi chưa có lượt đọc => tỉ lệ null', async () => {
    expect((await cache.stats()).total).toEqual({
      hits: 0,
      misses: 0,
      hitRate: null,
    });
  });

  it('clear chỉ xoá khoá cache:*, giữ dữ liệu khác trong Redis', async () => {
    await cache.getOrSet('pd:a', options, async () => 1);
    await flush();
    await redis.set('session:u1', 'x');

    expect(await cache.clear()).toBe(2); // cache:pd:a + cache:stats
    expect([...redis.store.keys()]).toEqual(['session:u1']);
    expect((await cache.stats()).total.hits).toBe(0);
  });
});
