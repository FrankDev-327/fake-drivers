import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { forwardError } from '../common/forward-error';
import logger from '../../logger';

@Injectable()
export class UsersService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  getProfile(userId: string) {
    return this.call('get', '/users/me', userId);
  }

  createPhotoUploadUrl(userId: string, body: unknown) {
    return this.call('post', '/users/me/photo/upload-url', userId, body);
  }

  confirmPhoto(userId: string, body: unknown) {
    return this.call('post', '/users/me/photo/confirm', userId, body);
  }

  deletePhoto(userId: string) {
    return this.call('delete', '/users/me/photo', userId);
  }

  private async call(method: 'get' | 'post' | 'delete', path: string, userId: string, body?: unknown) {
    const url = `${this.config.get('AUTH_SERVICE_URL')}${path}`;
    // identity comes from the verified JWT, never from what the client sent
    const headers = { 'x-user-id': userId };

    try {
      const response = await firstValueFrom(
        this.httpService.request({ method, url, data: body, headers }),
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to call auth-service', {
        path,
        error: (error as Error).message,
      });
      forwardError(error, 'Auth service');
    }
  }
}
