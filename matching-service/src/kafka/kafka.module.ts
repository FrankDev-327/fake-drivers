import { Module } from '@nestjs/common';
import { KafkaConsumer } from './kafka.consumer';
import { KafkaProducer } from './kafka.producer';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [KafkaConsumer, KafkaProducer],
  exports: [KafkaConsumer, KafkaProducer],
})
export class KafkaModule {}
