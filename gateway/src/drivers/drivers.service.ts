import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import logger from '../../logger';

@Injectable()
export class DriverService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getDriver(id: string): Promise<any> {
    try {
      const url = `${this.config.get('DRIVER_SERVICE_URL')}/drivers/${id}`;
      const response = await firstValueFrom(
        this.httpService.get(url),
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to call driver-service getDriver', {
        error: (error as Error).message,
        driverId: id,
      });
      throw new InternalServerErrorException('Driver service unavailable');
    }
  }

  async updateStatus(id: string, body: any): Promise<any> {
    try {
      const url = `${this.config.get('DRIVER_SERVICE_URL')}/drivers/${id}/status`;
      const response = await firstValueFrom(
        this.httpService.patch(url, body),
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to call driver-service updateStatus', {
        error: (error as Error).message,
        driverId: id,
      });
      throw new InternalServerErrorException('Driver service unavailable');
    }
  }

  async updateLocation(id: string, body: any): Promise<any> {
    try {
      const url = `${this.config.get('DRIVER_SERVICE_URL')}/drivers/${id}/location`;
      const response = await firstValueFrom(
        this.httpService.patch(url, body),
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to call driver-service updateLocation', {
        error: (error as Error).message,
        driverId: id,
      });
      throw new InternalServerErrorException('Driver service unavailable');
    }
  }
}