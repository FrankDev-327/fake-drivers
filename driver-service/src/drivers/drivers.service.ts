import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  HttpException,
  OnModuleInit,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DriverEntity, DriverStatus } from "../entities/drivers.entity";
import { RedisService } from "../redis/redis.service";
import { KafkaProducer } from "../kafka/kafka.service";
import { KafkaConsumer } from "../kafka/kafka.consumer";
import { MetricsService } from "../metrics/metrics.service";
import { UpdateStatusDto } from "./dto/update.status.dto";
import { UpdateLocationDto } from "./dto/update.location.dto";
import { CreateDriverDto } from './dto/create.drivers.dto';
import logger from "../../logger";

const TOPICS = {
  STATUS_UPDATED: "driver.status.updated",
  LOCATION_UPDATED: "driver.location.updated",
  USER_PHOTO_UPDATED: "user.photo.updated",
  DRIVER_ASSIGNED: "driver.assigned",
  RIDE_COMPLETED: "ride.completed",
  RIDE_STATUS_UPDATED: "ride.status.updated",
};

type DriverAssignedEvent = { rideId: string; driverId: string };
type RideFinishedEvent = { rideId: string; driverId: string | null; status: string };

type UserPhotoUpdatedEvent = {
  userId: string;
  role: string;
  hasPhoto: boolean;
};

@Injectable()
export class DriverService implements OnModuleInit {
  constructor(
    @InjectRepository(DriverEntity)
    private readonly driverRepository: Repository<DriverEntity>,
    private readonly redisService: RedisService,
    private readonly kafkaProducer: KafkaProducer,
    private readonly kafkaConsumer: KafkaConsumer,
    private readonly metricsService: MetricsService,
  ) { }

  onModuleInit() {
    this.kafkaConsumer.registerHandler(TOPICS.USER_PHOTO_UPDATED, (payload) =>
      this.handleUserPhotoUpdated(payload),
    );
    this.kafkaConsumer.registerHandler(TOPICS.DRIVER_ASSIGNED, (payload) =>
      this.handleDriverAssigned(payload),
    );
    this.kafkaConsumer.registerHandler(TOPICS.RIDE_COMPLETED, (payload) =>
      this.handleRideFinished(payload),
    );
    this.kafkaConsumer.registerHandler(TOPICS.RIDE_STATUS_UPDATED, (payload) => {
      // only cancellations free the driver; matched / in_progress updates are ignored here
      if (payload.status !== "cancelled") return Promise.resolve();
      return this.handleRideFinished(payload);
    });
  }

  async createDriver(dto: CreateDriverDto): Promise<DriverEntity> {
    try {
      const exists = await this.driverRepository.findOne({ where: { email: dto.email } });
      if (exists) {
        throw new ConflictException('Driver with this email already exists');
      }

      const driver = this.driverRepository.create({
        userId: dto.userId,
        name: dto.name,
        email: dto.email,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        status: DriverStatus.OFFLINE,
      });

      const saved = await this.driverRepository.save(driver);
      logger.info('Driver created', { driverId: saved.id });
      return saved;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      logger.error('Failed to create driver', { error: (error as Error).message });
      throw new InternalServerErrorException('Failed to create driver');
    }
  }


  async getDriver(id: string): Promise<DriverEntity> {
    try {
      const driver = await this.driverRepository.findOne({ where: { id } });
      if (!driver) {
        throw new NotFoundException(`Driver ${id} not found`);
      }
      return driver;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      logger.error("Failed to find driver", {
        error: (error as Error).message,
        driverId: id,
      });
      throw new InternalServerErrorException("Failed to find driver");
    }
  }

  async updateStatus(id: string, dto: UpdateStatusDto): Promise<DriverEntity> {
    try {
      const driver = await this.getDriver(id);

      // busy is owned by the ride lifecycle: set on driver.assigned, cleared on ride end.
      // a driver can't set it by hand, and can't leave it mid-ride (that would put a
      // driver who is still driving back into the matching pool)
      if (dto.status === DriverStatus.BUSY) {
        throw new UnprocessableEntityException(
          "Busy is set automatically when a ride is assigned",
        );
      }
      if (driver.status === DriverStatus.BUSY) {
        throw new ConflictException("Finish the current ride before changing status");
      }

      // no photo, no going online: the driver never enters the GEO pool,
      // so matching can't assign them a ride and they can't start one
      if (dto.status === DriverStatus.AVAILABLE && !driver.hasPhoto) {
        throw new UnprocessableEntityException(
          "Upload a profile photo before going online",
        );
      }

      await this.driverRepository.update(id, { status: dto.status });
      await this.redisService.handleDriverStatusChange(
        id,
        dto.status,
        driver.lat,
        driver.lng,
      );

      await this.kafkaProducer.publish(TOPICS.STATUS_UPDATED, {
        driverId: id,
        status: dto.status,
        timestamp: new Date().toISOString(),
      });

      this.metricsService.driverStatusUpdatesTotal.inc({ status: dto.status });
      logger.info("Driver status updated", {
        driverId: id,
        status: dto.status,
      });

      return { ...driver, status: dto.status };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error("Failed to update driver status", {
        error: (error as Error).message,
        driverId: id,
      });
      throw new InternalServerErrorException("Failed to update driver status");
    }
  }

  async updateLocation(
    id: string,
    dto: UpdateLocationDto,
  ): Promise<DriverEntity> {
    const end = this.metricsService.driverLocationUpdateDuration.startTimer({
      driver_id: id,
    });

    try {
      const driver = await this.getDriver(id);
      if (driver.status === DriverStatus.AVAILABLE) {
        await this.redisService.updateDriverLocation(id, dto.lat, dto.lng);
      }

      await this.driverRepository.update(id, { lat: dto.lat, lng: dto.lng });
      await this.kafkaProducer.publish(TOPICS.LOCATION_UPDATED, {
        driverId: id,
        lat: dto.lat,
        lng: dto.lng,
        timestamp: new Date().toISOString(),
      });

      this.metricsService.driverLocationUpdatesTotal.inc({ driver_id: id });
      logger.info("Driver location updated", {
        driverId: id,
        lat: dto.lat,
        lng: dto.lng,
      });

      return { ...driver, lat: dto.lat, lng: dto.lng };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      logger.error("Failed to update driver location", {
        error: (error as Error).message,
        driverId: id,
      });
      throw new InternalServerErrorException(
        "Failed to update driver location",
      );
    } finally {
      end();
    }
  }

  private async handleUserPhotoUpdated(event: UserPhotoUpdatedEvent): Promise<void> {
    if (event.role !== "driver") return;

    const driver = await this.driverRepository.findOne({
      where: { userId: event.userId },
    });
    if (!driver) {
      // driver profile not created yet; the photo flag is only synced for existing drivers
      logger.warn("Photo update for a user with no driver profile", {
        userId: event.userId,
      });
      return;
    }

    await this.driverRepository.update(driver.id, { hasPhoto: event.hasPhoto });

    // photo removed while online: take the driver offline and out of the matching pool.
    // a busy driver keeps the current ride and goes offline when it ends (see handleRideFinished)
    if (!event.hasPhoto && driver.status === DriverStatus.AVAILABLE) {
      await this.setStatusFromSystem(driver, DriverStatus.OFFLINE, "profile_photo_removed");
    }

    logger.info("Driver photo flag synced", {
      driverId: driver.id,
      hasPhoto: event.hasPhoto,
    });
  }

  // matching already removed the driver from the GEO pool; marking them busy in the DB is what
  // stops updateLocation from adding them back while they're driving
  private async handleDriverAssigned(event: DriverAssignedEvent): Promise<void> {
    const driver = await this.driverRepository.findOne({ where: { id: event.driverId } });
    if (!driver) {
      logger.warn("driver.assigned for an unknown driver", event);
      return;
    }
    if (driver.status === DriverStatus.BUSY) return; // redelivered event

    await this.setStatusFromSystem(driver, DriverStatus.BUSY, "ride_assigned", event.rideId);
  }

  // ride completed or cancelled: the driver goes back to the pool at their last known position,
  // unless their photo was removed during the ride, then they go offline
  private async handleRideFinished(event: RideFinishedEvent): Promise<void> {
    if (!event.driverId) return; // cancelled before a driver was assigned

    const driver = await this.driverRepository.findOne({ where: { id: event.driverId } });
    if (!driver || driver.status !== DriverStatus.BUSY) return; // unknown or already released

    const next = driver.hasPhoto ? DriverStatus.AVAILABLE : DriverStatus.OFFLINE;
    const reason = event.status === "cancelled" ? "ride_cancelled" : "ride_completed";
    await this.setStatusFromSystem(driver, next, reason, event.rideId);
  }

  // one place for status changes the system makes (not the driver): DB, GEO pool, event, metric
  private async setStatusFromSystem(
    driver: DriverEntity,
    status: DriverStatus,
    reason: string,
    rideId?: string,
  ): Promise<void> {
    await this.driverRepository.update(driver.id, { status });
    await this.redisService.handleDriverStatusChange(driver.id, status, driver.lat, driver.lng);
    await this.kafkaProducer.publish(TOPICS.STATUS_UPDATED, {
      driverId: driver.id,
      status,
      reason,
      ...(rideId && { rideId }),
      timestamp: new Date().toISOString(),
    });
    this.metricsService.driverStatusUpdatesTotal.inc({ status });
    logger.info("Driver status changed by the system", { driverId: driver.id, status, reason });
  }
}
