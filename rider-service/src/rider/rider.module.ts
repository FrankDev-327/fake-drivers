import { Module } from '@nestjs/common';
import { RiderService } from './rider.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiderEntity } from '../entities/rider.entity';
import { RiderController } from './rider.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RiderEntity])],
  providers: [RiderService],
  controllers: [RiderController]
})
export class RiderModule {}
