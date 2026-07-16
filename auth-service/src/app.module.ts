import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dbdatasource } from '../orm';
import { HealthcheckController } from './healthcheck/healthcheck.controller';
import { HealthModule } from './healthcheck/healthcheck.module';
import { UsersService } from './users/users.service';
import { UsersModule } from './users/users.module';

@Module({
  imports: [AuthModule, MetricsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dbdatasource),
    HealthModule,
    UsersModule,
  ],
  controllers: [HealthcheckController],
  providers: [UsersService],
})
export class AppModule { }
