import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { RideModule } from './ride/ride.module';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsMiddleware } from './metrics/metrics.middleware';
import { dbdatasource } from '../orm';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dbdatasource),
    MetricsModule,
    RideModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
