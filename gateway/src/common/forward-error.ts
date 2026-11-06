import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { isAxiosError } from 'axios';

// pass the downstream status and body through (400, 404, 409, 422...) instead of turning
// everything into a 500. Only a service that didn't answer at all becomes 503.
export function forwardError(error: unknown, serviceName: string): never {
  if (isAxiosError(error) && error.response) {
    throw new HttpException(error.response.data, error.response.status);
  }
  throw new ServiceUnavailableException(`${serviceName} unavailable`);
}
