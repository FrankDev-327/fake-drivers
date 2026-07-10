
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { logger } from './common/logger/logger';
 

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
 
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
 
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
 
  logger.info('Auth service started', { port });
}
 
bootstrap();
