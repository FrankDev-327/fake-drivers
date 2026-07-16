import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { DriverService } from './drivers.service';

@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Get(':id')
  getDriver(@Param('id') id: string) {
    return this.driverService.getDriver(id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(@Param('id') id: string, @Body() body: any) {
    return this.driverService.updateStatus(id, body);
  }

  @Patch(':id/location')
  @HttpCode(HttpStatus.OK)
  updateLocation(@Param('id') id: string, @Body() body: any) {
    return this.driverService.updateLocation(id, body);
  }
}