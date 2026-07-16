import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const end = this.metricsService.httpRequestDuration.startTimer();

    res.on('finish', () => {
      const labels = {
        method: req.method,
        route: req.route?.path ?? req.path,
        status_code: String(res.statusCode),
      };

      end(labels);
      this.metricsService.httpRequestsTotal.inc(labels);
    });

    next();
  }
}