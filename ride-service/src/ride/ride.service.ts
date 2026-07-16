import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ride, RideStatus } from './ride.entity';
import { RequestRideDto } from './dto/request-ride.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { KafkaProducer } from '../kafka/kafka.producer';
import { KafkaConsumer } from '../kafka/kafka.consumer';
import { MetricsService } from '../common/metrics/metrics.service';
import logger from '../../logger';

const TOPICS = {
  RIDE_REQUESTED: 'ride.requested',
  RIDE_STATUS_UPDATED: 'ride.status.updated',
  RIDE_COMPLETED: 'ride.completed',
};

@Injectable()
export class RideService implements OnModuleInit {
  constructor(
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
    private readonly kafkaProducer: KafkaProducer,
    private readonly kafkaConsumer: KafkaConsumer,
    private readonly metricsService: MetricsService,
  ) {}

  onModuleInit() {
    // register handler for driver.assigned event from matching-service
    this.kafkaConsumer.registerHandler('driver.assigned', async (payload) => {
      await this.handleDriverAssigned(payload);
    });
  }

  async requestRide(dto: RequestRideDto): Promise<Ride> {
    try {
      const ride = this.rideRepository.create({
        riderId: dto.riderId,
        status: RideStatus.REQUESTED,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        destinationLat: dto.destinationLat,
        destinationLng: dto.destinationLng,
        driverId: null,
        fare: null,
      });

      const saved = await this.rideRepository.save(ride);

      await this.kafkaProducer.publish(TOPICS.RIDE_REQUESTED, {
        rideId: saved.id,
        riderId: saved.riderId,
        pickupLat: saved.pickupLat,
        pickupLng: saved.pickupLng,
        destinationLat: saved.destinationLat,
        destinationLng: saved.destinationLng,
        timestamp: new Date().toISOString(),
      });

      this.metricsService.rideRequestsTotal.inc();

      logger.info('Ride requested', { rideId: saved.id, riderId: saved.riderId });

      return saved;

    } catch (error) {
      logger.error('Failed to request ride', { error: (error as Error).message });
      throw new InternalServerErrorException('Failed to request ride');
    }
  }

  async getRide(id: string): Promise<Ride> {
    try {
      const ride = await this.rideRepository.findOne({ where: { id } });
      if (!ride) {
        throw new NotFoundException(`Ride ${id} not found`);
      }
      return ride;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      logger.error('Failed to find ride', { error: (error as Error).message, rideId: id });
      throw new InternalServerErrorException('Failed to find ride');
    }
  }

  async getRidesByRiderId(riderId: string): Promise<Ride[]> {
    try {
      return this.rideRepository.find({
        where: { riderId },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      logger.error('Failed to get rides by riderId', { error: (error as Error).message, riderId });
      throw new InternalServerErrorException('Failed to get rides');
    }
  }

  async updateStatus(id: string, dto: UpdateStatusDto): Promise<Ride> {
    try {
      const ride = await this.getRide(id);

      await this.rideRepository.update(id, {
        status: dto.status,
        ...(dto.fare && { fare: dto.fare }),
      });

      const topic = dto.status === RideStatus.COMPLETED
        ? TOPICS.RIDE_COMPLETED
        : TOPICS.RIDE_STATUS_UPDATED;

      await this.kafkaProducer.publish(topic, {
        rideId: id,
        riderId: ride.riderId,
        driverId: ride.driverId,
        status: dto.status,
        fare: dto.fare ?? ride.fare,
        timestamp: new Date().toISOString(),
      });

      this.metricsService.rideStatusUpdatesTotal.inc({ status: dto.status });

      logger.info('Ride status updated', { rideId: id, status: dto.status });

      return { ...ride, status: dto.status, fare: dto.fare ?? ride.fare };

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      logger.error('Failed to update ride status', { error: (error as Error).message, rideId: id });
      throw new InternalServerErrorException('Failed to update ride status');
    }
  }

  private async handleDriverAssigned(payload: { rideId: string; driverId: string }): Promise<void> {
    try {
      await this.rideRepository.update(payload.rideId, {
        driverId: payload.driverId,
        status: RideStatus.MATCHED,
      });

      await this.kafkaProducer.publish(TOPICS.RIDE_STATUS_UPDATED, {
        rideId: payload.rideId,
        driverId: payload.driverId,
        status: RideStatus.MATCHED,
        timestamp: new Date().toISOString(),
      });

      logger.info('Driver assigned to ride', { rideId: payload.rideId, driverId: payload.driverId });

    } catch (error) {
      logger.error('Failed to handle driver assigned', {
        error: (error as Error).message,
        rideId: payload.rideId,
      });
    }
  }
}