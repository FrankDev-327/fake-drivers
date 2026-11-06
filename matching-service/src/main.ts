import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import logger from '../logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3005;
  await app.listen(port);

  logger.info('Matching service started', { port });
}

bootstrap();
