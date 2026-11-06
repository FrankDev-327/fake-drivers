import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { MetricsService } from '../metrics/metrics.service';
import logger from '../../logger';

@Injectable()
export class KafkaProducer implements OnModuleInit, OnModuleDestroy {
  private readonly producer: Producer;

  constructor(
    config: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    const kafka = new Kafka({
      brokers: [config.getOrThrow<string>('KAFKA_BROKER')],
      clientId: 'matching-service-producer',
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

  async publish(topic: string, message: object): Promise<void> {
    await this.producer.send({
      topic,
      // key by ride, so every event of one ride lands on the same partition in order
      messages: [{ key: message['rideId']?.toString(), value: JSON.stringify(message) }],
    });
    this.metricsService.kafkaMessagesProducedTotal.inc({ topic });
    logger.info('Kafka message published', { topic });
  }
}
