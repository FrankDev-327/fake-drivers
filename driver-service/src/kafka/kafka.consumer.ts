import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka } from 'kafkajs';
import logger from '../../logger';

type Handler = (payload: any) => Promise<void>;

@Injectable()
export class KafkaConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly consumer: Consumer;
  private readonly handlers = new Map<string, Handler>();

  constructor(config: ConfigService) {
    const kafka = new Kafka({
      brokers: [config.getOrThrow<string>('KAFKA_BROKER')],
      clientId: 'driver-service-consumer',
    });
    this.consumer = kafka.consumer({ groupId: 'driver-service-group' });
  }

  // services register handlers in onModuleInit, so start consuming only after all of them ran,
  // otherwise early messages have no handler and their offsets get committed anyway
  registerHandler(topic: string, handler: Handler) {
    this.handlers.set(topic, handler);
  }

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
          logger.error('Skipping malformed Kafka message', { topic });
          return;
        }

        try {
          await this.handlers.get(topic)(payload);
        } catch (error) {
          // rethrow so kafkajs retries instead of committing the offset and losing the event
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
