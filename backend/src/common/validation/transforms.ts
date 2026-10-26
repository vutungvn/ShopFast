import { ValidateIf } from 'class-validator';

type TransformArg = { value: unknown };

export const trim = ({ value }: TransformArg) =>
  typeof value === 'string' ? value.trim() : value;

/** Query string "true"/"false" => boolean. `@Type(() => Boolean)` sẽ biến "false" thành true. */
export const toBoolean = ({ value }: TransformArg) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

/** "a,b" hoặc ?x=a&x=b => ["a", "b"], bỏ phần tử rỗng. */
export const toStringList = ({ value }: TransformArg) => {
  if (value === undefined) return undefined;
  const parts = (Array.isArray(value) ? value : [value]).flatMap((v) =>
    typeof v === 'string' ? v.split(',') : [v],
  );
  return parts
    .map((v) => (typeof v === 'string' ? v.trim() : v))
    .filter((v) => v !== '');
};

/**
 * Dùng cho DTO cập nhật thay cho `@IsOptional()`: chỉ bỏ qua khi không gửi field.
 * `@IsOptional()` cũng bỏ qua `null`, khiến `{ "name": null }` lọt xuống DB và lỗi 500.
 */
export const IsOptionalNonNull = () =>
  ValidateIf((_object, value) => value !== undefined);
