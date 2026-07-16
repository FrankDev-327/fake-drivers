import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { RiderService } from './rider.service';
import { CreateRiderDto } from './dto/create.rider.dto';

@Controller('riders')
export class RiderController {
  constructor(private readonly riderService: RiderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createRider(@Body() dto: CreateRiderDto) {
    return this.riderService.createRider(dto);
  }

  @Get(':id')
  getRider(@Param('id') id: string) {
    return this.riderService.getRider(id);
  }
}