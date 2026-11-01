/** Người gọi API: tài khoản (khi access token hợp lệ) và IP. RateLimitGuard gắn vào request trước khi tính hạn mức */
export interface RateLimitClient {
  userId?: string;
  ip: string;
}

export type RateLimitedRequest = { rateLimitClient?: RateLimitClient };

export function rateLimitClientOf(request: object): RateLimitClient {
  const client = (request as RateLimitedRequest).rateLimitClient;
  if (!client) throw new Error('RateLimitGuard chưa xác định người gọi');
  return client;
}
