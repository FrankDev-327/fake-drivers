import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { forwardError } from '../common/forward-error';
import logger from '../../logger';

@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  register(dto: RegisterDto) {
    return this.call('post', '/auth/register', dto);
  }

  login(dto: LoginDto) {
    return this.call('post', '/auth/login', dto);
  }

  private async call(method: 'get' | 'post', path: string, body?: unknown) {
    const url = `${this.config.get('AUTH_SERVICE_URL')}${path}`;

    try {
      const response = await firstValueFrom(
        this.httpService.request({ method, url, data: body }),
      );
      return response.data;
    } catch (error) {
      // never log the body here, it carries the password
      logger.error('Failed to call auth-service', {
        path,
        error: (error as Error).message,
      });
      forwardError(error, 'Auth service');
    }
  }
}
