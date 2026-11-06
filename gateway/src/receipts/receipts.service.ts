import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { forwardError } from '../common/forward-error';
import logger from '../../logger';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  getMyReceipts(userId: string) {
    return this.call('get', '/receipts/me', userId);
  }

  private async call(method: 'get', path: string, userId: string) {
    const url = `${this.config.get('EMAIL_SERVICE_URL')}${path}`;
    // identity comes from the verified JWT, never from what the client sent
    const headers = { 'x-user-id': userId };

    try {
      const response = await firstValueFrom(this.httpService.request({ method, url, headers }));
      return response.data;
    } catch (error) {
      logger.error('Failed to call email-service', {
        path,
        error: (error as Error).message,
      });
      forwardError(error, 'Email service');
    }
  }
}
