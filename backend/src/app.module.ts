import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

/** Tiến trình API: HTTP + WebSocket. */
@Module({
  imports: [CoreModule, HealthModule, AuthModule, UsersModule],
})
export class AppModule {}
