import { Module } from '@nestjs/common';
import { KafkaProducer } from './kafka.producer';
import { KafkaConsumer } from './kafka.consumer';

@Module({
    providers: [KafkaProducer, KafkaConsumer],
    exports: [KafkaProducer, KafkaConsumer]
})
export class KafkaModule { }
