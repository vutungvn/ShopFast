import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  /** @example khach@shopfast.vn */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(254, { message: 'Email quá dài' })
  email: string;

  /**
   * Ít nhất 8 ký tự, gồm cả chữ và số
   * @example MatKhau123
   */
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  // bcrypt chỉ dùng 72 byte đầu; dài hơn sẽ bị cắt ngầm nên chặn ngay từ đầu
  @IsByteLength(0, 72, { message: 'Mật khẩu quá dài (tối đa 72 byte)' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Mật khẩu phải gồm cả chữ và số',
  })
  password: string;

  /** @example Nguyễn Văn A */
  @Transform(trim)
  @IsString({ message: 'Họ tên không hợp lệ' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(100, { message: 'Họ tên tối đa 100 ký tự' })
  fullName: string;

  /** @example 0912345678 */
  @IsOptional()
  @Transform(trim)
  @Matches(/^(0|\+84)\d{9,10}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;
}
