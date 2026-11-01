import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Gửi email qua SMTP thật (Giai đoạn 5 bổ sung tài khoản, người gửi); chưa cấu hình thì không gửi
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),

  JWT_ACCESS_SECRET: z.string().min(32, 'phải dài ít nhất 32 ký tự'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // Đơn chưa thanh toán sau khoảng này thì không thanh toán được nữa và bị tự huỷ (trả kho)
  ORDER_PAYMENT_TIMEOUT_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 60),
  // Worker quét đơn quá hạn thanh toán để tự huỷ sau mỗi khoảng này (giây)
  ORDER_EXPIRY_SWEEP_SECONDS: z.coerce.number().int().positive().default(60),

  // Số lớp proxy đứng trước API (production: 1 lớp Nginx). Chỉ tin đúng số lớp này khi đọc
  // X-Forwarded-For, để khách không tự gửi header giả IP. 0 = API nhận request trực tiếp
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  // Hạn mức chung cho toàn bộ API trong mỗi cửa sổ THROTTLE_TTL_SECONDS
  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_USER_LIMIT: z.coerce.number().int().positive().default(120),
  // Chưa đăng nhập: nới hơn vì nhiều người có thể dùng chung một IP (NAT)
  THROTTLE_IP_LIMIT: z.coerce.number().int().positive().default(300),
  // Hạn mức riêng mỗi phút: đăng nhập theo IP, đặt đơn theo tài khoản (đặt nhỏ để thử trên giao diện)
  THROTTLE_LOGIN_LIMIT: z.coerce.number().int().positive().default(20),
  THROTTLE_ORDER_LIMIT: z.coerce.number().int().positive().default(5),
  // Chỉ để test: tắt rate limit (các bộ e2e đăng nhập rất nhiều lần từ cùng một IP)
  THROTTLE_DISABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;

/** Dừng ứng dụng ngay khi khởi động nếu cấu hình thiếu hoặc sai. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Cấu hình môi trường không hợp lệ: ${issues}`);
  }
  return parsed.data;
}
