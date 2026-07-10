import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Get,
    Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MetricsService } from '../metrics/metrics.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly metricsService: MetricsService,
    ) { }

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    // internal endpoint called by gateway to validate JWT
    @Post('validate')
    @HttpCode(HttpStatus.OK)
    validate(@Headers('authorization') authorization: string) {
        const token = authorization?.replace('Bearer ', '');
        return this.authService.validateToken(token);
    }

    @Get('metrics')
    async metrics() {
        return this.metricsService.getMetrics();
    }
}