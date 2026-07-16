import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { MetricsService } from '../metrics/metrics.service';
import logger from '../../logger';

@Injectable()
export class KafkaProducer implements OnModuleInit, OnModuleDestroy {
    private readonly kafka: Kafka;
    private readonly producer: Producer;

    constructor(
        private readonly config: ConfigService,
        private readonly metricsService: MetricsService,
    ) {
        this.kafka = new Kafka({
            brokers: [this.config.get<string>('KAFKA_BROKER')],
            clientId: 'matching-service-producer',
        });
        this.producer = this.kafka.producer();
    }

    async onModuleInit() {
        try {
            await this.producer.connect();
            logger.info('Kafka producer connected');
        } catch (error) {
            logger.error('Failed to connect Kafka producer', {
                error: (error as Error).message,
            });
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.producer.disconnect();
        logger.info('Kafka producer disconnected');
    }

    async publish(topic: string, message: object): Promise<void> {
        try {
            await this.producer.send({
                topic,
                messages: [{ value: JSON.stringify(message) }],
            });
            this.metricsService.kafkaMessagesProducedTotal.inc({ topic });
            logger.info('Kafka message published', { topic });
        } catch (error) {
            logger.error('Failed to publish Kafka message', {
                error: (error as Error).message,
                topic,
            });
            throw error;
        }
    }
}