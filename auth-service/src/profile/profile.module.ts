import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';
import { S3Module } from '../s3/s3.module';
import { KafkaModule } from '../kafka/kafka.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), S3Module, KafkaModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
