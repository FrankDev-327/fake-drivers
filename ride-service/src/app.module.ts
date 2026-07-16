import { Module } from '@nestjs/common';
import { RideModule } from './ride/ride.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [RideModule, MetricsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
