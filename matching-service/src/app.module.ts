import { Module } from '@nestjs/common';
import { MatchingModule } from './matching/matching.module';
import { MetricsModule } from './metrics/metrics.module';
import { KafkaModule } from './kafka/kafka.module';
import { RedisModule } from './redis/redis.module';


@Module({
  imports: [MatchingModule, MetricsModule, KafkaModule, RedisModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
