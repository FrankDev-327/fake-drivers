import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DriverService } from "./drivers.service";
import { DriverEntity } from "../entities/drivers.entity";
import { DriverController } from "./drivers.controller";
import { MetricsModule } from "../metrics/metrics.module";
import { RedisModule } from "../redis/redis.module";
import { KafkaModule } from "../kafka/kafka.module";

@Module({
  imports: [TypeOrmModule.forFeature([DriverEntity]), MetricsModule, RedisModule, KafkaModule],
  exports: [DriverService],
  providers: [DriverService],
  controllers: [DriverController],
})
export class DriversModule {}
