import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { Env } from './config/env.validation';
import { RedisIoAdapter } from './infra/realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config = app.get(ConfigService<Env, true>);
  // Chỉ ở main: e2e dùng adapter mặc định (một tiến trình, không cần Redis pub/sub)
  app.useWebSocketAdapter(
    new RedisIoAdapter(app, config.get('REDIS_URL', { infer: true })),
  );
  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('ShopFast API')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API đang chạy tại cổng ${port}`, 'Bootstrap');
}
bootstrap();
