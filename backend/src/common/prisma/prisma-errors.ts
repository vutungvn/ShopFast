import { Prisma } from '@prisma/client';

/**
 * Lỗi vi phạm ràng buộc UNIQUE (P2002): trả về các cột bị trùng, không phải thì trả null.
 * Bắt lỗi từ DB thay vì kiểm tra trước để không bị race khi 2 request tạo cùng lúc.
 */
export function uniqueViolationFields(err: unknown): string[] | null {
  if (
    !(err instanceof Prisma.PrismaClientKnownRequestError) ||
    err.code !== 'P2002'
  ) {
    return null;
  }
  const target = err.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  return typeof target === 'string' ? [target] : [];
}
