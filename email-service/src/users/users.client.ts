import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

export type UserContact = { id: string; email: string; name: string; role: string };

@Injectable()
export class UsersClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  // null when the user doesn't exist (permanent); throws on anything else so Kafka retries
  async getUser(userId: string): Promise<UserContact | null> {
    try {
      const url = `${this.config.get('AUTH_SERVICE_URL')}/internal/users/${userId}`;
      const response = await firstValueFrom(this.httpService.get<UserContact>(url, { timeout: 3000 }));
      return response.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  }
}
