import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dbdatasource } from '../orm';
import { RiderModule } from './rider/rider.module';

@Module({
  imports: [TypeOrmModule.forRoot(dbdatasource), RiderModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
