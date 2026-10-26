import { Module } from '@nestjs/common';
import { RefreshTokenRepository } from './refresh-token.repository';

/** Lưu trữ phiên đăng nhập (refresh token); dùng chung cho Auth và Users để tránh phụ thuộc vòng. */
@Module({
  providers: [RefreshTokenRepository],
  exports: [RefreshTokenRepository],
})
export class SessionsModule {}
