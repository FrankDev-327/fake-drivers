import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { RideModule } from './ride/ride.module';
import { MetricsModule } from './metrics/metrics.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RideEntity } from './entities/ride.entity';
import { dbdatasource } from '../orm';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [RideModule, MetricsModule, TypeOrmModule.forRoot(dbdatasource), KafkaModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule { }
