import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { KafkaProducer } from '../kafka/kafka.producer';
import { KafkaConsumer } from '../kafka/kafka.consumer';
import { MetricsService } from '../metrics/metrics.service';
import logger from '../../logger';

const TOPICS = {
  DRIVER_ASSIGNED: 'driver.assigned',
};

@Injectable()
export class MatchingService implements OnModuleInit {
  private readonly searchRadiusKm: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly kafkaProducer: KafkaProducer,
    private readonly kafkaConsumer: KafkaConsumer,
    private readonly metricsService: MetricsService,
    private readonly config: ConfigService,
  ) {
    this.searchRadiusKm = parseFloat(this.config.get<string>('SEARCH_RADIUS_KM', '5'));
  }

  onModuleInit() {
    this.kafkaConsumer.registerHandler('ride.requested', async (payload) => {
      await this.handleRideRequested(payload);
    });

    this.kafkaConsumer.registerHandler('driver.declined', async (payload) => {
      await this.handleDriverDeclined(payload);
    });
  }

  private async handleRideRequested(payload: {
    rideId: string;
    riderId: string;
    pickupLat: number;
    pickupLng: number;
  }): Promise<void> {
    const end = this.metricsService.matchingDuration.startTimer();

    try {
      this.metricsService.matchingAttemptsTotal.inc();

      logger.info('Matching ride with nearest driver', { rideId: payload.rideId });

      const driverId = await this.redisService.findNearestDriver(
        payload.pickupLat,
        payload.pickupLng,
        this.searchRadiusKm,
      );

      if (!driverId) {
        this.metricsService.matchingFailedTotal.inc();
        logger.warn('No available driver found', {
          rideId: payload.rideId,
          radiusKm: this.searchRadiusKm,
        });
        return;
      }

      // remove driver from available pool immediately to prevent double assignment
      await this.redisService.removeDriverFromAvailable(driverId);

      await this.kafkaProducer.publish(TOPICS.DRIVER_ASSIGNED, {
        rideId: payload.rideId,
        riderId: payload.riderId,
        driverId,
        timestamp: new Date().toISOString(),
      });

      this.metricsService.matchingSuccessTotal.inc();

      logger.info('Driver assigned to ride', {
        rideId: payload.rideId,
        driverId,
      });

    } catch (error) {
      logger.error('Failed to match ride with driver', {
        error: (error as Error).message,
        rideId: payload.rideId,
      });
    } finally {
      end();
    }
  }

  private async handleDriverDeclined(payload: {
    rideId: string;
    riderId: string;
    pickupLat: number;
    pickupLng: number;
    declinedDriverId: string;
  }): Promise<void> {
    logger.info('Driver declined, re-matching', {
      rideId: payload.rideId,
      declinedDriverId: payload.declinedDriverId,
    });

    // re-run matching excluding the declined driver
    await this.handleRideRequested({
      rideId: payload.rideId,
      riderId: payload.riderId,
      pickupLat: payload.pickupLat,
      pickupLng: payload.pickupLng,
    });
  }
}