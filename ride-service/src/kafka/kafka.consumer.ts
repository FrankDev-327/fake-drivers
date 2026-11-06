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
      clientId: 'ride-service-consumer',
    });
    this.consumer = kafka.consumer({ groupId: 'ride-service-group' });
  }

  registerHandler(topic: string, handler: Handler) {
    this.handlers.set(topic, handler);
  }

  // handlers are registered in RideService.onModuleInit, so start consuming only after
  // every module is initialised, otherwise early assignments have no handler and are lost
  async onApplicationBootstrap() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topics: [...this.handlers.keys()], fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        let payload: unknown;
        try {
          payload = JSON.parse(message.value.toString());
        } catch {
          // a malformed message can never succeed, skip it instead of blocking the partition
          this.metricsService.kafkaMessagesFailedTotal.inc({ topic });
          logger.error('Skipping malformed Kafka message', { topic });
          return;
        }

        try {
          await this.handlers.get(topic)(payload);
          this.metricsService.kafkaMessagesConsumedTotal.inc({ topic });
        } catch (error) {
          // rethrow so kafkajs retries: an assignment must not be lost, or the ride stays requested forever
          this.metricsService.kafkaMessagesFailedTotal.inc({ topic });
          logger.error('Failed to handle Kafka message, will retry', {
            topic,
            error: (error as Error).message,
          });
          throw error;
        }
      },
    });

    logger.info('Kafka consumer running', { topics: [...this.handlers.keys()] });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}
