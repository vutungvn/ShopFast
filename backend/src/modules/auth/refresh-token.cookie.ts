import { CookieOptions } from 'express';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * httpOnly: JavaScript phía client không đọc được (chống XSS lấy token).
 * sameSite=strict: trình duyệt không gửi cookie từ trang khác (chống CSRF).
 * path: chỉ gửi kèm các request tới /api/v1/auth, không đi theo mọi API.
 */
export function refreshTokenCookieOptions(
  isProduction: boolean,
  maxAgeMs?: number,
): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
    ...(maxAgeMs !== undefined && { maxAge: maxAgeMs }),
  };
}
