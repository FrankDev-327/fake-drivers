import { Module } from '@nestjs/common';
import { RideService } from './ride.service';
import { RideController } from './ride.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RideEntity } from '../entities/ride.entity';
import { MetricsModule } from '../metrics/metrics.module';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [TypeOrmModule.forFeature([RideEntity]), MetricsModule, KafkaModule],
  providers: [RideService],
  controllers: [RideController]
})
export class RideModule { }
