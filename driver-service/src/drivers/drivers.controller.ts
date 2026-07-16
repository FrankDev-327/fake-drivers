import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Headers,
} from "@nestjs/common";
import { DriverService } from "./drivers.service";
import { UpdateStatusDto } from "./dto/update.status.dto";
import { UpdateLocationDto } from "./dto/update.location.dto";

@Controller("drivers")
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Get(":id")
  getDriver(@Param("id") id: string) {
    return this.driverService.getDriver(id);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.driverService.updateStatus(id, dto);
  }

  @Patch(":id/location")
  updateLocation(
    @Param("id") id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.driverService.updateLocation(id, dto);
  }
}
