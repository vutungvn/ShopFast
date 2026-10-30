import { randomInt } from 'crypto';

/** Bỏ các ký tự dễ đọc nhầm: O/0, I/1 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SUFFIX_LENGTH = 4;
// Việt Nam UTC+7 quanh năm (không có giờ mùa hè)
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Mã đơn "SF-YYMMDD-XXXX", ngày theo giờ Việt Nam. Phần đuôi ngẫu nhiên (32^4 ≈ 1 triệu mã/ngày)
 * để người ngoài không đoán được số đơn; trùng thì bên gọi tạo mã khác (UNIQUE ở DB).
 */
export function generateOrderCode(
  now = new Date(),
  randomIndex: (max: number) => number = randomInt,
): string {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const date = [
    vn.getUTCFullYear() % 100,
    vn.getUTCMonth() + 1,
    vn.getUTCDate(),
  ]
    .map((n) => String(n).padStart(2, '0'))
    .join('');
  const suffix = Array.from(
    { length: SUFFIX_LENGTH },
    () => ALPHABET[randomIndex(ALPHABET.length)],
  ).join('');
  return `SF-${date}-${suffix}`;
}
