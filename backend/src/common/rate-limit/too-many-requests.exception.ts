import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * 429 kèm thời gian chờ. Body: `{ statusCode, error, message, retryAfter }`;
 * `message` là câu tiếng Việt đã gồm thời gian chờ, `retryAfter` (giây) để giao diện đếm ngược.
 */
export class TooManyRequestsException extends HttpException {
  readonly retryAfter: number;

  /** `reason`: câu tiếng Việt, chưa có phần thời gian chờ */
  constructor(reason: string, retryAfterSeconds: number) {
    const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `${reason}, vui lòng thử lại sau ${formatWait(retryAfter)}`,
        retryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    this.retryAfter = retryAfter;
  }
}

/** Thêm header chuẩn `Retry-After` cho mọi lỗi 429 (từ rate limit lẫn khoá đăng nhập) */
@Catch(TooManyRequestsException)
export class TooManyRequestsFilter implements ExceptionFilter<TooManyRequestsException> {
  catch(exception: TooManyRequestsException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response
      .status(HttpStatus.TOO_MANY_REQUESTS)
      .setHeader('Retry-After', String(exception.retryAfter))
      .json(exception.getResponse());
  }
}

/** 42 => "42 giây"; 60 => "1 phút"; 90 => "1 phút 30 giây" */
export function formatWait(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} giây`;
  return rest === 0 ? `${minutes} phút` : `${minutes} phút ${rest} giây`;
}
