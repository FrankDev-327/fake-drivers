import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
