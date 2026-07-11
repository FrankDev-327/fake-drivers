import { Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from '../auth/dto/register.dto';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post('register')
    async register(dto: RegisterDto): Promise<{ token: string }> {
        return this.usersService.register(dto);
    }
}
