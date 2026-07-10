import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dbdatasource } from '../orm';
import { HealthcheckController } from './healthcheck/healthcheck.controller';
import { HealthModule } from './healthcheck/healthcheck.module';

@Module({
  imports: [AuthModule, MetricsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dbdatasource),
    HealthModule,
  ],
  controllers: [HealthcheckController],
  providers: [],
})
export class AppModule { }
