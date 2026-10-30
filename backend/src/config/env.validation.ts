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
