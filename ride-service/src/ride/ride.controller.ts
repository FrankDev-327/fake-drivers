import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RideService } from './ride.service';
import { RequestRideDto } from './dto/request-ride.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('rides')
export class RideController {
  constructor(private readonly rideService: RideService) {}

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  requestRide(@Body() dto: RequestRideDto) {
    return this.rideService.requestRide(dto);
  }

  @Get(':id')
  getRide(@Param('id') id: string) {
    return this.rideService.getRide(id);
  }

  @Get('rider/:riderId')
  getRidesByRiderId(@Param('riderId') riderId: string) {
    return this.rideService.getRidesByRiderId(riderId);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.rideService.updateStatus(id, dto);
  }
}