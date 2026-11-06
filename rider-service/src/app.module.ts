import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dbdatasource } from '../orm';
import { RiderModule } from './rider/rider.module';

@Module({
  imports: [TypeOrmModule.forRoot(dbdatasource), RiderModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
