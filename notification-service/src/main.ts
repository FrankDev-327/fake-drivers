import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis/redis-io.adapter';
import logger from '../logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });

  // Redis adapter so several notification instances share socket rooms
  app.useWebSocketAdapter(new RedisIoAdapter(app, process.env.REDIS_URL));
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3007;
  await app.listen(port);

  logger.info('Notification service started', { port });
}

bootstrap();
