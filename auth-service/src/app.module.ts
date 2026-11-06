import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dbdatasource } from '../orm';
import { HealthController } from './health/health.controller';
import { UsersService } from './users/users.service';
import { UsersModule } from './users/users.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [AuthModule, MetricsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dbdatasource),
    UsersModule,
    ProfileModule,
  ],
  controllers: [HealthController],
  providers: [UsersService],
})
export class AppModule { }
