/** Slug hợp lệ: chữ thường không dấu, số, nối bằng một dấu gạch ngang. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Điện thoại Samsung S24" => "dien-thoai-samsung-s24". Trả chuỗi rỗng nếu không còn ký tự hợp lệ. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
