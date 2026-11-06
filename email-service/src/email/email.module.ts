import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SentEmailEntity } from '../entities/sent-email.entity';
import { SesModule } from '../ses/ses.module';
import { UsersModule } from '../users/users.module';
import { KafkaModule } from '../kafka/kafka.module';
import { MetricsModule } from '../metrics/metrics.module';
import { EmailService } from './email.service';
import { ReceiptsController } from './receipts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SentEmailEntity]), SesModule, UsersModule, KafkaModule, MetricsModule],
  controllers: [ReceiptsController],
  providers: [EmailService],
})
export class EmailModule {}
