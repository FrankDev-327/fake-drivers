import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import logger from '../../looger';

@Injectable()
export class KafkaProducer implements OnModuleInit, OnModuleDestroy {
  private readonly producer: Producer;

  constructor(config: ConfigService) {
    const kafka = new Kafka({
      brokers: [config.getOrThrow<string>('KAFKA_BROKER')],
      clientId: 'auth-service-producer',
    });
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
    logger.info('Kafka producer connected');
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publish(topic: string, key: string, message: object): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(message) }],
    });
    logger.info('Kafka message published', { topic });
  }
}
