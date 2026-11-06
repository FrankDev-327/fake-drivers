import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka } from 'kafkajs';
import { MetricsService } from '../metrics/metrics.service';
import logger from '../../logger';

type Handler = (payload: any) => Promise<void>;

@Injectable()
export class KafkaConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly consumer: Consumer;
  private readonly handlers = new Map<string, Handler>();

  constructor(
    config: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    const kafka = new Kafka({
      brokers: [config.getOrThrow<string>('KAFKA_BROKER')],
      clientId: 'notification-service-consumer',
    });
    this.consumer = kafka.consumer({ groupId: 'notification-service-group' });
  }

  registerHandler(topic: string, handler: Handler) {
    this.handlers.set(topic, handler);
  }

  // handlers are registered in NotificationService.onModuleInit, so start consuming only
  // after every module is initialised, otherwise early events have no handler and are lost
  async onApplicationBootstrap() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topics: [...this.handlers.keys()], fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          await this.handlers.get(topic)(payload);
          this.metricsService.kafkaMessagesConsumedTotal.inc({ topic });
        } catch (error) {
          // notifications are real-time and best effort: a retried push minutes later is useless,
          // so count and log the failure and move on instead of blocking the partition
          this.metricsService.kafkaMessagesFailedTotal.inc({ topic });
          logger.error('Failed to process Kafka message', {
            topic,
            error: (error as Error).message,
          });
        }
      },
    });

    logger.info('Kafka consumer running', { topics: [...this.handlers.keys()] });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}
