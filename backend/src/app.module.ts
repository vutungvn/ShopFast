import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';
import { HealthModule } from './modules/health/health.module';

/** Tiến trình API: HTTP + WebSocket. */
@Module({
  imports: [CoreModule, HealthModule],
})
export class AppModule {}
