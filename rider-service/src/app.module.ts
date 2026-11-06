import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dbdatasource } from '../orm';
import { RiderModule } from './rider/rider.module';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsMiddleware } from './metrics/metrics.middleware';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), TypeOrmModule.forRoot(dbdatasource), MetricsModule, RiderModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
