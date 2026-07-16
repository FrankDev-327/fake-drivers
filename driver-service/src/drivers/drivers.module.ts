import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DriverService } from "./drivers.service";
import { DriverEntity } from "../entities/drivers.entity";
import { DriverController } from "./drivers.controller";
import { MetricsModule } from "../metrics/metrics.module";

@Module({
  imports: [TypeOrmModule.forFeature([DriverEntity]), MetricsModule],
  exports: [DriverService],
  providers: [DriverService],
  controllers: [DriverController],
})
export class DriversModule {}
