import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpModule } from '@nestjs/axios';

import { AuthMiddleware } from './middleware/auth.middleware';
import { AuthModule } from './auth/auth.module';
import { MetricsMiddleware } from './metricsmiddleware/metrics.middleware';
import { MetricsModule } from './metrics/metrics.module';
import { DriversModule } from './drivers/drivers.module';
/* 
import { MetricsModule } from './common/metrics/metrics.module';

import { RideModule } from './modules/ride/ride.module';
import { DriverModule } from './modules/driver/driver.module';
import { RiderModule } from './modules/rider/rider.module';
import { PaymentModule } from './modules/payment/payment.module';
import { MetricsService } from './metrics/metrics.service';
import { MetricsController } from './metrics/metrics.controller';




 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl: config.get<number>('RATE_LIMIT_TTL', 60),
        limit: config.get<number>('RATE_LIMIT_MAX', 100),
      }]),
    }),
    TerminusModule,
    HttpModule,
    AuthModule,
    MetricsModule,
    DriversModule,
    /*MetricsModule,
    AuthModule,
    RideModule,
    DriverModule,
    RiderModule,
    PaymentModule,*/
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}