import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.consumer';

@Module({
  providers: [KafkaService]
})
export class KafkaModule {}
