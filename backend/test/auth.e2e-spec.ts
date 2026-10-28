import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import request, { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Env } from '../src/config/env.validation';
import { PrismaService } from '../src/infra/prisma/prisma.service';

// Cần hạ tầng đang chạy: docker compose up -d
// Mọi tài khoản test dùng đuôi @e2e.test và bị xoá sau khi chạy.
const DOMAIN = '@e2e.test';
const PASSWORD = 'MatKhau123';
const COOKIE = 'refresh_token';
const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${DOMAIN}`;

/** Lấy chuỗi Set-Cookie của refresh token trong response. */
function setCookieOf(res: Response): string | undefined {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith(`${COOKIE}=`));
}

/** Chuyển Set-Cookie thành header Cookie để gửi ở request sau. */
function cookieOf(res: Response): string {
  const setCookie = setCookieOf(res);
  if (!setCookie) throw new Error('Response không có cookie refresh_token');
  return setCookie.split(';')[0];
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  // Giá trị kỳ vọng (TTL, bcrypt cost) lấy từ cấu hình đang chạy để test không phụ thuộc .env của từng máy
  let config: ConfigService<Env, true>;

  const register = (email: string, extra: Record<string, unknown> = {}) =>
    http
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, fullName: 'Người Test', ...extra });

  const login = (email: string, password = PASSWORD) =>
    http.post('/api/v1/auth/login').send({ email, password });

  /** Đăng ký rồi đăng nhập: trả response của login (access token + cookie). */
  const signup = async (email: string) => {
    await register(email).expect(201);
    return login(email).expect(200);
  };

  const refresh = (cookie?: string) => {
    const req = http.post('/api/v1/auth/refresh');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  const logout = (cookie?: string) => {
    const req = http.post('/api/v1/auth/logout');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  async function createUserWithRole(role: Role) {
    const email = uniqueEmail(role.toLowerCase());
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hash(PASSWORD, 10),
        fullName: role,
        role,
      },
    });
    const res = await login(email).expect(200);
    return {
      email,
      id: res.body.user.id as string,
      accessToken: res.body.accessToken as string,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    config = app.get(ConfigService);
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await app.close();
  });

  describe('Đăng ký', () => {
    it('TC01 đăng ký hợp lệ => 201, chỉ trả thông tin user (CUSTOMER), không lộ passwordHash', async () => {
      const email = uniqueEmail('reg');
      const res = await register(email).expect(201);
      expect(res.body).toMatchObject({ email, role: 'CUSTOMER' });
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('TC01b đăng ký không cấp token: không có accessToken, không đặt cookie, không tạo phiên', async () => {
      const res = await register(uniqueEmail('notoken')).expect(201);
      expect(res.body).not.toHaveProperty('accessToken');
      expect(res.body).not.toHaveProperty('refreshToken');
      expect(setCookieOf(res)).toBeUndefined();
      const sessions = await prisma.refreshToken.count({
        where: { userId: res.body.id },
      });
      expect(sessions).toBe(0);
    });

    it('TC02 email được chuẩn hoá (trim + chữ thường)', async () => {
      const email = uniqueEmail('case');
      const res = await register(`  ${email.toUpperCase()}  `).expect(201);
      expect(res.body.email).toBe(email);
    });

    it('TC03 email trùng => 409', async () => {
      const email = uniqueEmail('dup');
      await register(email).expect(201);
      const res = await register(email).expect(409);
      expect(res.body.message).toBe('Email đã được sử dụng');
    });

    it.each([
      ['email sai định dạng', { email: 'khong-phai-email' }],
      ['mật khẩu < 8 ký tự', { password: 'Ab1' }],
      ['mật khẩu không có số', { password: 'chiCoChuThoi' }],
      ['mật khẩu > 72 byte (giới hạn bcrypt)', { password: 'a1'.repeat(37) }],
      ['thiếu họ tên', { fullName: '' }],
      ['số điện thoại sai', { phone: '12345' }],
    ])('TC04 dữ liệu không hợp lệ (%s) => 400', async (_case, override) => {
      await register(uniqueEmail('bad'), override).expect(400);
    });

    it('TC05 tự gán role ADMIN khi đăng ký => 400, không leo thang quyền', async () => {
      const email = uniqueEmail('escalate');
      await register(email, { role: 'ADMIN' }).expect(400);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });

    it('TC06 mật khẩu lưu dạng bcrypt hash (đúng cost cấu hình), không phải bản rõ', async () => {
      const email = uniqueEmail('hash');
      await register(email).expect(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const cost = String(
        config.get('BCRYPT_SALT_ROUNDS', { infer: true }),
      ).padStart(2, '0');
      expect(user.passwordHash).toMatch(new RegExp(`^\\$2[aby]\\$${cost}\\$`));
      expect(user.passwordHash).not.toContain(PASSWORD);
    });
  });

  describe('Đăng nhập', () => {
    const email = uniqueEmail('login');
    beforeAll(async () => {
      await register(email).expect(201);
    });

    it('TC07 đúng email + mật khẩu => 200 kèm access token', async () => {
      const res = await login(email).expect(200);
      expect(res.body.user.email).toBe(email);
      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
      });
      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('TC08 sai mật khẩu và email không tồn tại => cùng 401, cùng thông báo', async () => {
      const wrong = await login(email, 'SaiMatKhau1').expect(401);
      const unknown = await login(uniqueEmail('none')).expect(401);
      expect(wrong.body.message).toBe('Email hoặc mật khẩu không đúng');
      expect(unknown.body.message).toBe(wrong.body.message);
    });

    it('TC08b đăng nhập sai không đặt cookie', async () => {
      const res = await login(email, 'SaiMatKhau1').expect(401);
      expect(setCookieOf(res)).toBeUndefined();
    });
  });

  describe('Refresh token trong cookie', () => {
    it('TC09 đăng nhập: refresh token nằm trong cookie httpOnly, KHÔNG có trong body', async () => {
      const res = await signup(uniqueEmail('cookie'));
      expect(res.body).not.toHaveProperty('refreshToken');

      const setCookie = setCookieOf(res)!;
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Strict/i);
      expect(setCookie).toMatch(/Path=\/api\/v1\/auth/);
      const maxAgeSeconds =
        config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 24 * 60 * 60;
      expect(setCookie).toMatch(new RegExp(`Max-Age=${maxAgeSeconds}(;|$)`));
    });

    it('TC10 refresh bằng cookie => access token mới, cookie được xoay vòng', async () => {
      const reg = await signup(uniqueEmail('rot'));
      const res = await refresh(cookieOf(reg)).expect(200);

      expect(res.body).not.toHaveProperty('refreshToken');
      expect(cookieOf(res)).not.toBe(cookieOf(reg));
      await http
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
    });

    it('TC11 refresh không có cookie => 401', async () => {
      await refresh().expect(401);
    });

    it('TC12 dùng lại cookie cũ => 401 và thu hồi luôn cookie mới (phát hiện đánh cắp)', async () => {
      const reg = await signup(uniqueEmail('reuse'));
      const first = await refresh(cookieOf(reg)).expect(200);

      // Kẻ gian dùng cookie cũ
      await refresh(cookieOf(reg)).expect(401);
      // Cookie mới của người dùng thật cũng bị thu hồi
      await refresh(cookieOf(first)).expect(401);
    });

    it('TC13 cookie bịa => 401 và cookie bị xoá', async () => {
      const res = await refresh(`${COOKIE}=token-bia-dat`).expect(401);
      expect(setCookieOf(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('TC14 refresh token hết hạn => 401', async () => {
      const reg = await signup(uniqueEmail('exp'));
      await prisma.refreshToken.updateMany({
        where: { userId: reg.body.user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await refresh(cookieOf(reg)).expect(401);
    });

    it('TC15 DB chỉ lưu hash của refresh token', async () => {
      const reg = await signup(uniqueEmail('store'));
      const raw = decodeURIComponent(cookieOf(reg).split('=')[1]);
      const rows = await prisma.refreshToken.findMany({
        where: { userId: reg.body.user.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).not.toBe(raw);
    });
  });

  describe('Đăng xuất', () => {
    it('TC16 đăng xuất => 200 kèm message, cookie bị xoá, refresh không dùng được nữa', async () => {
      const reg = await signup(uniqueEmail('logout'));
      const res = await logout(cookieOf(reg)).expect(200);
      expect(res.body).toEqual({ message: 'Đăng xuất thành công' });
      expect(setCookieOf(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
      await refresh(cookieOf(reg)).expect(401);
    });

    it('TC17 đăng xuất một thiết bị không ảnh hưởng thiết bị khác', async () => {
      const email = uniqueEmail('multi');
      await register(email).expect(201);
      const phone = await login(email).expect(200);
      const laptop = await login(email).expect(200);

      await logout(cookieOf(phone)).expect(200);
      await refresh(cookieOf(laptop)).expect(200);
    });

    it('TC18 đăng xuất khi không có cookie vẫn 200 (idempotent)', async () => {
      const res = await logout().expect(200);
      expect(res.body).toEqual({ message: 'Đăng xuất thành công' });
    });
  });

  describe('Endpoint công khai và endpoint được bảo vệ', () => {
    it('TC19 register, login, refresh, logout, /health không cần access token', async () => {
      const email = uniqueEmail('public');
      await register(email).expect(201);
      await login(email).expect(200);
      await logout().expect(200);
      await http.get('/health').expect(200);
    });

    it('TC20 GET /users/me có access token => 200', async () => {
      const email = uniqueEmail('me');
      const { body } = await signup(email);
      const res = await http
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      expect(res.body.email).toBe(email);
    });

    it('TC21 GET /users/me không có access token => 401', async () => {
      const res = await http.get('/api/v1/users/me').expect(401);
      expect(res.body.message).toBe('Bạn cần đăng nhập');
    });

    it('TC22 access token giả mạo / bị sửa => 401', async () => {
      const { body } = await signup(uniqueEmail('tamper'));
      const [h, , s] = (body.accessToken as string).split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({ sub: body.user.id, role: 'ADMIN' }),
      ).toString('base64url');
      await http
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${h}.${forgedPayload}.${s}`)
        .expect(401);
    });
  });

  describe('Phân quyền @Roles()', () => {
    let admin: { id: string; accessToken: string };

    beforeAll(async () => {
      admin = await createUserWithRole(Role.ADMIN);
    });

    it.each([Role.CUSTOMER, Role.SUPPORT, Role.WAREHOUSE])(
      'TC23 %s gọi GET /users (@Roles(ADMIN)) => 403',
      async (role) => {
        const actor = await createUserWithRole(role);
        const res = await http
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(403);
        expect(res.body.message).toBe(
          'Bạn không có quyền thực hiện thao tác này',
        );
      },
    );

    it('TC24 chưa đăng nhập gọi endpoint @Roles(ADMIN) => 401 (xác thực trước, phân quyền sau)', async () => {
      await http.get('/api/v1/users').expect(401);
    });

    it('TC25 ADMIN xem danh sách người dùng, lọc theo role, có phân trang', async () => {
      const res = await http
        .get('/api/v1/users?role=ADMIN&page=1&limit=5')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 5 });
      expect(
        res.body.items.every((u: { role: string }) => u.role === 'ADMIN'),
      ).toBe(true);
    });

    it('TC26 ADMIN đổi vai trò => phiên cũ bị thu hồi, đăng nhập lại nhận vai trò mới', async () => {
      const email = uniqueEmail('promote');
      const reg = await signup(email);

      const res = await http
        .patch(`/api/v1/users/${reg.body.user.id}/role`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ role: 'WAREHOUSE' })
        .expect(200);
      expect(res.body.role).toBe('WAREHOUSE');

      await refresh(cookieOf(reg)).expect(401);
      const relogin = await login(email).expect(200);
      expect(relogin.body.user.role).toBe('WAREHOUSE');
    });

    it('TC27 ADMIN tự đổi vai trò của mình => 400', async () => {
      await http
        .patch(`/api/v1/users/${admin.id}/role`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ role: 'CUSTOMER' })
        .expect(400);
    });

    it('TC28 vai trò không hợp lệ hoặc id sai định dạng => 400', async () => {
      await http
        .patch(`/api/v1/users/${admin.id}/role`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ role: 'SUPERADMIN' })
        .expect(400);
      await http
        .patch('/api/v1/users/khong-phai-uuid/role')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ role: 'SUPPORT' })
        .expect(400);
    });
  });
});
