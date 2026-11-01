import { ArgumentsHost } from '@nestjs/common';
import {
  formatWait,
  TooManyRequestsException,
  TooManyRequestsFilter,
} from './too-many-requests.exception';

describe('TooManyRequestsException', () => {
  it.each([
    [1, '1 giây'],
    [42, '42 giây'],
    [60, '1 phút'],
    [90, '1 phút 30 giây'],
    [900, '15 phút'],
  ])('formatWait(%i) => "%s"', (seconds, text) => {
    expect(formatWait(seconds)).toBe(text);
  });

  it('làm tròn lên thời gian chờ, tối thiểu 1 giây', () => {
    expect(new TooManyRequestsException('X', 41.2).retryAfter).toBe(42);
    expect(new TooManyRequestsException('X', 0).retryAfter).toBe(1);
  });

  it('filter: trả 429 kèm header Retry-After và body chuẩn', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new TooManyRequestsFilter().catch(
      new TooManyRequestsException('Bạn đặt đơn quá nhanh', 37),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '37');
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Bạn đặt đơn quá nhanh, vui lòng thử lại sau 37 giây',
      retryAfter: 37,
    });
  });
});
