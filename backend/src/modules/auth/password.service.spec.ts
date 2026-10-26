import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validation';
import { PasswordService } from './password.service';

describe('PasswordService (bcrypt)', () => {
  const config = {
    get: () => 10,
  } as unknown as ConfigService<Env, true>;
  const service = new PasswordService(config);

  beforeAll(() => service.onModuleInit());

  it('hash có định dạng bcrypt và khác mật khẩu gốc', async () => {
    const hashed = await service.hash('MatKhau123');
    expect(hashed).toMatch(/^\$2[aby]\$10\$/);
    expect(hashed).not.toContain('MatKhau123');
  });

  it('cùng mật khẩu cho ra hash khác nhau (có salt)', async () => {
    expect(await service.hash('MatKhau123')).not.toBe(
      await service.hash('MatKhau123'),
    );
  });

  it('verify đúng / sai mật khẩu', async () => {
    const hashed = await service.hash('MatKhau123');
    await expect(service.verify(hashed, 'MatKhau123')).resolves.toBe(true);
    await expect(service.verify(hashed, 'SaiMatKhau1')).resolves.toBe(false);
  });

  it('không có hash (email không tồn tại) vẫn so sánh với hash giả và trả false', async () => {
    await expect(service.verify(undefined, 'MatKhau123')).resolves.toBe(false);
  });
});
