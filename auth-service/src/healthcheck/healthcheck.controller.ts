import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HttpHealthIndicator, HealthCheck } from '@nestjs/terminus';

@Controller('healthcheck')
export class HealthcheckController {

    constructor(
        private health: HealthCheckService,
        private http: HttpHealthIndicator,
    ) { }

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.http.pingCheck('nestjs-docs', 'http://localhost:3000'),
        ]);
    }

    @Get('up')
    @HealthCheck()
    checkServerUp() {
        return {
            "status": "up"
        }
    }
}
