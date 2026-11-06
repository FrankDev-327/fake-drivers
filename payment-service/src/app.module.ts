import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsMiddleware } from './metrics/metrics.middleware';

@Module({
  imports: [MetricsModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
