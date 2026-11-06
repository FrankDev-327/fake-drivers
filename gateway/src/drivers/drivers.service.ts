import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { forwardError } from '../common/forward-error';
import logger from '../../logger';

@Injectable()
export class DriverService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  getDriver(id: string) {
    return this.call('get', `/drivers/${id}`);
  }

  updateStatus(id: string, body: unknown) {
    return this.call('patch', `/drivers/${id}/status`, body);
  }

  updateLocation(id: string, body: unknown) {
    return this.call('patch', `/drivers/${id}/location`, body);
  }

  private async call(method: 'get' | 'patch', path: string, body?: unknown) {
    const url = `${this.config.get('DRIVER_SERVICE_URL')}${path}`;

    try {
      const response = await firstValueFrom(
        this.httpService.request({ method, url, data: body }),
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to call driver-service', {
        path,
        error: (error as Error).message,
      });
      forwardError(error, 'Driver service');
    }
  }
}
