import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { RedisModule } from '../redis/redis.module';
import { KafkaModule } from '../kafka/kafka.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [RedisModule, KafkaModule, MetricsModule],
  providers: [MatchingService],
})
export class MatchingModule {}
