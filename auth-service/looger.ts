import { createLogger, transports, format } from 'winston';
import * as path from 'path';

export const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json(),
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: path.join('/logs', 'auth-service.log'),
    }),
  ],
});