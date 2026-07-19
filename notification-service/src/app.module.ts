import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';
import { RedisService } from './redis/redis.service';
import { RedisModule } from './redis/redis.module';
import { NotificationGateway } from './notification/notification.gateway';
import { NotificationModule } from './notification/notification.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [MetricsModule, RedisModule, NotificationModule, KafkaModule],
  controllers: [],
  providers: [RedisService, NotificationGateway],
})
export class AppModule {}
