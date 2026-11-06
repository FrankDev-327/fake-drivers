import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { dbdatasource } from "../orm";
import { HealthController } from './health/health.controller';
import { MetricsModule } from "./metrics/metrics.module";
import { DriversModule } from "./drivers/drivers.module";
import { RedisModule } from './redis/redis.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dbdatasource),
    MetricsModule,
    DriversModule,
    RedisModule,
    KafkaModule,
  ],
  controllers: [HealthController],
  providers: [],
  exports: [],
})
export class AppModule {}
