import { Module } from "@nestjs/common";
import { MetricsModule } from "./metrics/metrics.module";
import { DriversModule } from "./drivers/drivers.module";
import { RedisModule } from './redis/redis.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [MetricsModule, DriversModule, RedisModule, KafkaModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule {}
