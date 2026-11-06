import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import logger from '../../logger';

// same key driver-service writes available drivers to
const DRIVERS_GEO_KEY = 'drivers:available';

// GEOSEARCH + ZREM in one script: Redis runs it atomically, so two rides (or two matching
// instances) can never claim the same driver. Returns nil when nobody is in range.
const CLAIM_NEAREST_DRIVER = `
local ids = redis.call('GEOSEARCH', KEYS[1], 'FROMLONLAT', ARGV[1], ARGV[2], 'BYRADIUS', ARGV[3], 'km', 'ASC', 'COUNT', 1)
if #ids == 0 then
  return false
end
redis.call('ZREM', KEYS[1], ids[1])
return ids[1]
`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'));
    this.client.defineCommand('claimNearestDriver', { numberOfKeys: 1, lua: CLAIM_NEAREST_DRIVER });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async claimNearestDriver(lat: number, lng: number, radiusKm: number): Promise<string | null> {
    // GEO commands take longitude first
    const driverId = await (this.client as Redis & {
      claimNearestDriver(key: string, lng: number, lat: number, radiusKm: number): Promise<string | null>;
    }).claimNearestDriver(DRIVERS_GEO_KEY, lng, lat, radiusKm);

    if (driverId) {
      logger.info('Driver claimed from available pool', { driverId });
    }
    return driverId;
  }
}
