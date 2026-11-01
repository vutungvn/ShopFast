import { HttpStatus } from '@nestjs/common';
import Redis from 'ioredis';
import { TooManyRequestsException } from '../../common/rate-limit/too-many-requests.exception';
import { LoginAttemptsService } from './login-attempts.service';

/** Redis giả trong bộ nhớ: đủ các lệnh dịch vụ dùng, có hạn sống theo ms */
class FakeRedis {
  readonly store = new Map<string, { value: string; expiresAt?: number }>();
  failure: Error | null = null;

  private alive(key: string) {
    const entry = this.store.get(key);
    if (entry?.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  private check() {
    if (this.failure) throw this.failure;
  }

  pttl = jest.fn(async (key: string) => {
    this.check();
    const entry = this.alive(key);
    if (!entry) return -2;
    return entry.expiresAt === undefined ? -1 : entry.expiresAt - Date.now();
  });

  set = jest.fn(async (key: string, value: string, _px: 'PX', ms: number) => {
    this.check();
    this.store.set(key, { value, expiresAt: Date.now() + ms });
    return 'OK';
  });

  del = jest.fn(async (key: string) => {
    this.check();
    return this.store.delete(key) ? 1 : 0;
  });

  multi = () => {
    const ops: Array<() => unknown> = [];
    const chain = {
      incr: (key: string) => {
        ops.push(() => {
          const entry = this.alive(key);
          const next = Number(entry?.value ?? 0) + 1;
          this.store.set(key, {
            value: String(next),
            expiresAt: entry?.expiresAt,
          });
          return next;
        });
        return chain;
      },
      pexpire: (key: string, ms: number) => {
        ops.push(() => {
          const entry = this.alive(key);
          if (entry) entry.expiresAt = Date.now() + ms;
          return 1;
        });
        return chain;
      },
      exec: async () => {
        this.check();
        return ops.map((op) => [null, op()]);
      },
    };
    return chain;
  };
}

const EMAIL = 'khach01@shopfast.vn';

describe('LoginAttemptsService', () => {
  let redis: FakeRedis;
  let service: LoginAttemptsService;
  let now: jest.SpyInstance;

  beforeEach(() => {
    redis = new FakeRedis();
    service = new LoginAttemptsService(redis as unknown as Redis);
    now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => jest.restoreAllMocks());

  /** Sai n lần; trả lỗi 429 nếu có lần nào bị khoá */
  async function fail(times: number, email = EMAIL) {
    let locked: TooManyRequestsException | undefined;
    for (let i = 0; i < times; i++) {
      await service.recordFailure(email).catch((err) => (locked = err));
    }
    return locked;
  }

  const lockedFor = async (email = EMAIL) => {
    const err = await service.assertNotLocked(email).catch((e) => e);
    return err instanceof TooManyRequestsException ? err.retryAfter : 0;
  };

  it('trả số lần còn được sai trước khi khoá', async () => {
    expect(await service.recordFailure(EMAIL)).toBe(4);
    expect(await service.recordFailure(EMAIL)).toBe(3);
    expect(await service.recordFailure(EMAIL)).toBe(2);
  });

  it('sai lần thứ 5 => khoá 1 phút, báo 429 ngay lần đó', async () => {
    await fail(4);
    const err = await service.recordFailure(EMAIL).catch((e) => e);

    expect(err).toBeInstanceOf(TooManyRequestsException);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(err.getResponse()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message:
        'Tài khoản tạm khoá do nhập sai mật khẩu nhiều lần, vui lòng thử lại sau 1 phút',
      retryAfter: 60,
    });
    expect(await lockedFor()).toBe(60);
  });

  it('hết thời gian khoá => đăng nhập lại được', async () => {
    await fail(5);
    now.mockReturnValue(1_000_000 + 60_001);
    expect(await lockedFor()).toBe(0);
  });

  it('khoá leo thang: lần sai thứ 10 => 5 phút, 15 => 15 phút, 20 => vẫn 15 phút', async () => {
    const steps: Array<[number, number]> = [];
    for (const target of [5, 10, 15, 20]) {
      const err = await fail(5);
      steps.push([target, err!.retryAfter]);
    }
    expect(steps).toEqual([
      [5, 60],
      [10, 300],
      [15, 900],
      [20, 900],
    ]);
  });

  it('đăng nhập đúng => đếm lại từ đầu', async () => {
    await fail(4);
    await service.reset(EMAIL);
    expect(await service.recordFailure(EMAIL)).toBe(4);
  });

  it('15 phút không sai thêm => quên các lần sai trước', async () => {
    await fail(4);
    now.mockReturnValue(1_000_000 + 15 * 60_000 + 1);
    expect(await service.recordFailure(EMAIL)).toBe(4);
  });

  it('đếm theo từng tài khoản: khoá A không ảnh hưởng B', async () => {
    await fail(5, 'a@shopfast.vn');
    expect(await lockedFor('a@shopfast.vn')).toBe(60);
    expect(await lockedFor('b@shopfast.vn')).toBe(0);
  });

  it('không phân biệt hoa thường, khoảng trắng của email', async () => {
    await fail(5, '  Khach01@ShopFast.vn ');
    expect(await lockedFor(EMAIL)).toBe(60);
  });

  it('không lưu nguyên email trong Redis', async () => {
    await fail(5);
    const keys = [...redis.store.keys()];
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some((k) => k.includes('khach01'))).toBe(false);
  });

  it('Redis lỗi => đếm và khoá trong bộ nhớ, vẫn chặn được', async () => {
    redis.failure = new Error('Connection is closed');
    const err = await fail(5);
    expect(err?.retryAfter).toBe(60);
    expect(await lockedFor()).toBe(60);
  });
});
