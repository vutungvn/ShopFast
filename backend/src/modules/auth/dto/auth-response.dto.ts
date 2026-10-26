import { UserResponseDto } from '../../users/dto/user-response.dto';

/** Token cấp ra từ service. refreshToken chỉ dùng nội bộ để đặt cookie, không trả về body. */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AccessTokenResponseDto {
  accessToken: string;
  tokenType: 'Bearer';
  /** Số giây access token còn hiệu lực */
  expiresIn: number;
}

export class AuthResponseDto extends AccessTokenResponseDto {
  user: UserResponseDto;
}
