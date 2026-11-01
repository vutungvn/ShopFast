import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  SkipThrottle,
  ThrottlerException,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Env } from '../../config/env.validation';
import { throttlerOptions } from './rate-limit.module';
import { RateLimitGuard } from './rate-limit.guard';

const SECRET = 'test-secret-test-secret-test-secret-123';

class ProductsController {
  list() {}
  detail() {}
  @SkipThrottle()
  skipped() {}
}

type FakeResponse = { headers: Record<string, unknown> };

/** Request giả tới một route của ProductsController */
function call(
  guard: RateLimitGuard,
  request: { ip?: string; token?: string },
  route: keyof ProductsController = 'list',
) {
  const req = {
    ip: request.ip ?? '10.0.0.1',
    headers: request.token ? { authorization: `Bearer ${request.token}` } : {},
  };
  const res: FakeResponse & { header(name: string, value: unknown): void } = {
    headers: {},
    header(name, value) {
      this.headers[name] = value;
    },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getHandler: () => ProductsController.prototype[route],
    getClass: () => ProductsController,
  } as unknown as ExecutionContext;
  return { result: guard.canActivate(context), res };
}

describe('RateLimitGuard', () => {
  const jwt = new JwtService({ secret: SECRET });
  const token = (sub: string) =>
    jwt.sign({ sub, email: `${sub}@shopfast.vn`, role: Role.CUSTOMER });
  let env: Partial<Env>;
  let storage: ThrottlerStorageService;
  let guard: RateLimitGuard;

  beforeEach(async () => {
    env = {
      THROTTLE_DISABLED: false,
      THROTTLE_TTL_SECONDS: 60,
      THROTTLE_USER_LIMIT: 3,
      THROTTLE_IP_LIMIT: 5,
    };
    const config = {
      get: (key: keyof Env) => env[key],
    } as unknown as ConfigService<Env, true>;
    storage = new ThrottlerStorageService();
    guard = new RateLimitGuard(
      throttlerOptions(config, storage),
      storage,
      new Reflector(),
      jwt,
      config,
    );
    await guard.onModuleInit();
  });

  afterEach(() => storage.onApplicationShutdown());

  /** Gọi n lần, trả về response của lần cuối */
  async function callTimes(
    n: number,
    request: { ip?: string; token?: string },
  ) {
    let last: FakeResponse | undefined;
    for (let i = 0; i < n; i++) {
      const { result, res } = call(guard, request);
      await result;
      last = res;
    }
    return last!;
  }

  it('chưa đăng nhập => đếm theo IP với hạn mức IP', async () => {
    const { result, res } = call(guard, {});
    await expect(result).resolves.toBe(true);
    expect(res.headers).toMatchObject({
      'X-RateLimit-Limit': 5,
      'X-RateLimit-Remaining': 4,
    });
  });

  it('đã đăng nhập => đếm theo tài khoản với hạn mức tài khoản', async () => {
    const res = await callTimes(1, { token: token('u1') });
    expect(res.headers).toMatchObject({
      'X-RateLimit-Limit': 3,
      'X-RateLimit-Remaining': 2,
    });
  });

  it('vượt hạn mức => 429 kèm Retry-After', async () => {
    await callTimes(3, { token: token('u1') });
    const { result, res } = call(guard, { token: token('u1') });
    await expect(result).rejects.toThrow(ThrottlerException);
    expect(res.headers['Retry-After']).toBe(60);
  });

  it('hai tài khoản chung một IP (NAT) có bộ đếm riêng', async () => {
    await callTimes(3, { token: token('u1') });
    await expect(call(guard, { token: token('u2') }).result).resolves.toBe(
      true,
    );
  });

  it('một bộ đếm chung cho mọi route, không đếm riêng từng route', async () => {
    await callTimes(3, { token: token('u1') });
    await expect(
      call(guard, { token: token('u1') }, 'detail').result,
    ).rejects.toThrow(ThrottlerException);
  });

  it('token giả hoặc hết hạn => đếm theo IP', async () => {
    const forged = new JwtService({ secret: 'khac-'.repeat(8) }).sign({
      sub: 'u1',
    });
    const res = await callTimes(1, { token: forged });
    expect(res.headers['X-RateLimit-Limit']).toBe(5);
  });

  it('IPv4 dạng IPv6 (::ffff:) và IPv4 tính là cùng một IP', async () => {
    await callTimes(3, { ip: '::ffff:1.2.3.4' });
    const res = await callTimes(1, { ip: '1.2.3.4' });
    expect(res.headers['X-RateLimit-Remaining']).toBe(1);
  });

  it('route có @SkipThrottle (vd /health) không bị đếm', async () => {
    const { result, res } = call(guard, {}, 'skipped');
    await expect(result).resolves.toBe(true);
    expect(res.headers).toEqual({});
  });

  it('THROTTLE_DISABLED (chỉ dùng khi test) => không đếm', async () => {
    env.THROTTLE_DISABLED = true;
    await callTimes(10, {});
    expect(storage.storage.size).toBe(0);
  });
});
