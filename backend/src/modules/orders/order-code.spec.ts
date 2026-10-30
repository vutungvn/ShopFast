import { generateOrderCode } from './order-code';

describe('generateOrderCode', () => {
  it('đúng định dạng SF-YYMMDD-XXXX, chỉ dùng ký tự không dễ nhầm', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateOrderCode()).toMatch(
        /^SF-\d{6}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/,
      );
    }
  });

  it('ngày tính theo giờ Việt Nam (UTC+7)', () => {
    // 23:30 UTC ngày 29/10 = 06:30 ngày 30/10 giờ Việt Nam
    const code = generateOrderCode(new Date('2026-10-29T23:30:00Z'), () => 0);
    expect(code).toBe('SF-261030-AAAA');
  });

  it('trước 17:00 UTC vẫn là cùng ngày', () => {
    const code = generateOrderCode(new Date('2026-01-05T16:59:59Z'), () => 31);
    expect(code).toBe('SF-260105-9999');
  });
});
