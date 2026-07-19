import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer } from 'kafkajs';
import { MetricsService } from '../metrics/metrics.service';
import logger from '../../logger';

@Injectable()
export class KafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private handlers: Map<string, (message: any) => Promise<void>> = new Map();

  constructor(
    private readonly config: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.kafka = new Kafka({
      brokers: [this.config.get<string>('KAFKA_BROKER')],
      clientId: 'notification-service-consumer',
    });
    this.consumer = this.kafka.consumer({ groupId: 'notification-service-group' });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: [
          'driver.assigned',
          'ride.status.updated',
          'ride.completed',
          'payment.completed',
          'payment.failed',
        ],
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async ({ topic, message }) => {
          try {
            const payload = JSON.parse(message.value.toString());
            const handler = this.handlers.get(topic);
            if (handler) {
              await handler(payload);
              this.metricsService.kafkaMessagesConsumedTotal.inc({ topic });
            }
          } catch (error) {
            logger.error('Failed to process Kafka message', {
              error: (error as Error).message,
              topic,
            });
          }
        },
      });

      logger.info('Kafka consumer connected and subscribed to notification topics');
    } catch (error) {
      logger.error('Failed to connect Kafka consumer', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }

  registerHandler(topic: string, handler: (message: any) => Promise<void>) {
    this.handlers.set(topic, handler);
  }
}