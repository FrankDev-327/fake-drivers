import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dbdatasource } from '../orm';
import { HealthController } from './health/health.controller';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsMiddleware } from './metrics/metrics.middleware';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dbdatasource),
    MetricsModule,
    EmailModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
