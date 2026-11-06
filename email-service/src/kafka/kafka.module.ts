import { Module } from '@nestjs/common';
import { KafkaConsumer } from './kafka.consumer';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [KafkaConsumer],
  exports: [KafkaConsumer],
})
export class KafkaModule {}
