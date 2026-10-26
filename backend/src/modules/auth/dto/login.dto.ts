import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  /** @example khach@shopfast.vn */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  /** @example MatKhau123 */
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MaxLength(128, { message: 'Mật khẩu tối đa 128 ký tự' })
  password: string;
}
