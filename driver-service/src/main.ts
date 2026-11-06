import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import logger from '../logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });

  // the DTOs carry class-validator rules; without this pipe they were never checked
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3002;
  await app.listen(port);

  logger.info('Driver service started', { port });
}

bootstrap();
