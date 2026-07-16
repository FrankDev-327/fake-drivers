import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { RedisService } from '../redis/redis.service';
import { KafkaProducer } from '../kafka/kafka.producer';
import { KafkaConsumer } from '../kafka/kafka.consumer';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [MatchingService, RedisService, KafkaProducer, KafkaConsumer],
})
export class MatchingModule { }