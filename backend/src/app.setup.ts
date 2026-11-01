import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { Env } from './config/env.validation';

/** Cấu hình dùng chung cho main.ts và e2e test để test chạy đúng như production. */
export function configureApp(app: INestApplication): void {
  // Sau Nginx: req.ip lấy IP khách từ X-Forwarded-For, chỉ tin đúng số lớp proxy của mình
  const proxyHops = app
    .get(ConfigService<Env, true>)
    .get('TRUST_PROXY_HOPS', { infer: true });
  if (proxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', proxyHops);
  }
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}
