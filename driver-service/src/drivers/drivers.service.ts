import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DriverEntity, DriverStatus } from "../entities/drivers.entity";
import { RedisService } from "../redis/redis.service";
import { KafkaProducer } from "../kafka/kafka.service";
import { MetricsService } from "../metrics/metrics.service";
import { UpdateStatusDto } from "./dto/update.status.dto";
import { UpdateLocationDto } from "./dto/update.location.dto";
import { CreateDriverDto } from './dto/create.drivers.dto';
import logger from "../../logger";

const TOPICS = {
  STATUS_UPDATED: "driver.status.updated",
  LOCATION_UPDATED: "driver.location.updated",
};

@Injectable()
export class DriverService {
  constructor(
    @InjectRepository(DriverEntity)
    private readonly driverRepository: Repository<DriverEntity>,
    private readonly redisService: RedisService,
    private readonly kafkaProducer: KafkaProducer,
    private readonly metricsService: MetricsService,
  ) { }

  async createDriver(dto: CreateDriverDto): Promise<DriverEntity> {
    try {
      const exists = await this.driverRepository.getDriver({ where: { email: dto.email } });
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
      if (error instanceof NotFoundException) throw error;
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
}
