import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SkipThrottle, ThrottlerStorageService } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Env } from '../../config/env.validation';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimit, throttlerOptions } from './rate-limit.policies';
import { TooManyRequestsException } from './too-many-requests.exception';

const SECRET = 'test-secret-test-secret-test-secret-123';

class TestController {
  list() {}
  detail() {}
  @SkipThrottle()
  health() {}
  @RateLimit('login')
  login() {}
  @RateLimit('order')
  placeOrder() {}
  @RateLimit('otp')
  sendCode() {}
}

type Route = keyof TestController;
type FakeResponse = { headers: Record<string, unknown> };
interface FakeRequest {
  ip?: string;
  token?: string;
  body?: object;
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
      THROTTLE_LOGIN_LIMIT: 2,
      THROTTLE_ORDER_LIMIT: 2,
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

  /** Một request giả tới route của TestController */
  function call(request: FakeRequest, route: Route = 'list') {
    const req = {
      ip: request.ip ?? '10.0.0.1',
      headers: request.token
        ? { authorization: `Bearer ${request.token}` }
        : {},
      body: request.body,
    };
    const res: FakeResponse & { header(name: string, value: unknown): void } = {
      headers: {},
      header(name, value) {
        this.headers[name] = value;
      },
    };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      getHandler: () => TestController.prototype[route],
      getClass: () => TestController,
    } as unknown as ExecutionContext;
    return { result: guard.canActivate(context), res };
  }

  /** Gọi n lần (đều phải qua), trả về response của lần cuối */
  async function callTimes(n: number, request: FakeRequest, route?: Route) {
    let last: FakeResponse | undefined;
    for (let i = 0; i < n; i++) {
      const { result, res } = call(request, route);
      await result;
      last = res;
    }
    return last!;
  }

  const rejection = (request: FakeRequest, route?: Route) =>
    call(request, route).result.then(
      () => undefined,
      (err: unknown) => err as TooManyRequestsException,
    );

  describe('hạn mức chung', () => {
    it('chưa đăng nhập => đếm theo IP với hạn mức IP', async () => {
      const res = await callTimes(1, {});
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

    it('vượt hạn mức => 429 tiếng Việt kèm retryAfter', async () => {
      await callTimes(3, { token: token('u1') });
      const err = await rejection({ token: token('u1') });
      expect(err).toBeInstanceOf(TooManyRequestsException);
      expect(err!.getResponse()).toEqual({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau 1 phút',
        retryAfter: 60,
      });
    });

    it('hai tài khoản chung một IP (NAT) có bộ đếm riêng', async () => {
      await callTimes(3, { token: token('u1') });
      await expect(call({ token: token('u2') }).result).resolves.toBe(true);
    });

    it('một bộ đếm chung cho mọi route, không đếm riêng từng route', async () => {
      await callTimes(3, { token: token('u1') });
      expect(await rejection({ token: token('u1') }, 'detail')).toBeInstanceOf(
        TooManyRequestsException,
      );
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
      const res = await callTimes(1, {}, 'health');
      expect(res.headers).toEqual({});
    });

    it('THROTTLE_DISABLED (chỉ dùng khi test) => không đếm', async () => {
      env.THROTTLE_DISABLED = true;
      await callTimes(10, {});
      expect(storage.storage.size).toBe(0);
    });

    it('sự kiện WebSocket (gateway realtime) => không đếm, không đọc request HTTP', async () => {
      const context = {
        getType: () => 'ws',
        switchToHttp: () => {
          throw new Error('không được đọc request HTTP');
        },
      } as unknown as ExecutionContext;
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(storage.storage.size).toBe(0);
    });
  });

  describe('hạn mức riêng', () => {
    it('đăng nhập: theo IP, chặt hơn hạn mức chung, câu báo riêng', async () => {
      const res = await callTimes(2, {}, 'login');
      expect(res.headers['X-RateLimit-Limit-login']).toBe(2);

      const err = await rejection({}, 'login');
      expect(err!.getResponse()).toMatchObject({
        message: 'Bạn đăng nhập quá nhiều lần, vui lòng thử lại sau 1 phút',
      });
      // Route khác của cùng IP chỉ tính hạn mức chung
      await expect(call({}).result).resolves.toBe(true);
    });

    it('đăng nhập: IP khác không bị ảnh hưởng', async () => {
      await callTimes(2, { ip: '1.1.1.1' }, 'login');
      await expect(call({ ip: '2.2.2.2' }, 'login').result).resolves.toBe(true);
    });

    it('đặt đơn: theo tài khoản, đổi IP không thoát', async () => {
      await callTimes(1, { token: token('u1'), ip: '1.1.1.1' }, 'placeOrder');
      await callTimes(1, { token: token('u1'), ip: '2.2.2.2' }, 'placeOrder');
      const err = await rejection(
        { token: token('u1'), ip: '3.3.3.3' },
        'placeOrder',
      );
      expect(err!.getResponse()).toMatchObject({
        message: 'Bạn đặt đơn quá nhanh, vui lòng thử lại sau 1 phút',
      });
    });

    it('gửi mã: theo email nhận mã (3 lần / 15 phút), đổi IP không thoát', async () => {
      const body = { email: 'khach01@shopfast.vn' };
      for (const ip of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
        await callTimes(1, { ip, body }, 'sendCode');
      }
      const err = await rejection(
        { ip: '4.4.4.4', body: { email: ' KHACH01@shopfast.vn' } },
        'sendCode',
      );
      expect(err!.retryAfter).toBe(900);
      // Email khác vẫn gửi được
      await expect(
        call({ ip: '4.4.4.4', body: { email: 'khac@shopfast.vn' } }, 'sendCode')
          .result,
      ).resolves.toBe(true);
    });
  });
});
