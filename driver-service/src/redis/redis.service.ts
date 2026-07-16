import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { DriverStatus } from "../entities/drivers.entity";
import logger from "../../logger";

const DRIVERS_GEO_KEY = "drivers:available";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    try {
      this.client = new Redis(this.config.get<string>("REDIS_URL"));
      logger.info("Redis client connected");
    } catch (error) {
      logger.error("Failed to connect Redis client", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
    logger.info("Redis client disconnected");
  }

  async updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    try {
      // GEOADD expects longitude first then latitude
      await this.client.geoadd(DRIVERS_GEO_KEY, lng, lat, driverId);
      logger.info("Driver location updated in Redis GEO");
    } catch (error) {
      logger.error("Failed to update driver location in Redis GEO", {
        error: (error as Error).message,
        driverId,
      });
      throw error;
    }
  }

  async removeDriverFromGeo(driverId: string): Promise<void> {
    try {
      await this.client.zrem(DRIVERS_GEO_KEY, driverId);
      logger.info("Driver removed from Redis GEO");
    } catch (error) {
      logger.error("Failed to remove driver from Redis GEO", {
        error: (error as Error).message,
        driverId,
      });
      throw error;
    }
  }

  async handleDriverStatusChange(
    driverId: string,
    status: DriverStatus,
    lat?: number,
    lng?: number,
  ): Promise<void> {
    if (status === DriverStatus.AVAILABLE && lat && lng) {
      await this.updateDriverLocation(driverId, lat, lng);
    } else {
      // driver is busy or offline, remove from available pool
      await this.removeDriverFromGeo(driverId);
    }
  }
}
