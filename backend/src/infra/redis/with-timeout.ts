/** Lệnh Redis không trả lời trong `ms` thì coi như lỗi (lệnh vẫn chạy tiếp ở Redis, chỉ là không chờ nữa) */
export function withTimeout<R>(promise: Promise<R>, ms: number): Promise<R> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Lệnh Redis quá ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
