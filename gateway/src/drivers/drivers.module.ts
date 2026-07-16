import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DriverController } from './drivers.controller';
import { DriverService } from './drivers.service';

@Module({
  imports: [HttpModule],
  controllers: [DriverController],
  providers: [DriverService],
})
export class DriversModule {}