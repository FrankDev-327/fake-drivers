import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { KafkaModule } from '../kafka/kafka.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [KafkaModule, MetricsModule],
  providers: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
