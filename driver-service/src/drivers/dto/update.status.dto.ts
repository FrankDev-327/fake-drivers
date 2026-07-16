import { IsEnum } from 'class-validator';
import { DriverStatus } from '../../entities/drivers.entity';

export class UpdateStatusDto {
  @IsEnum(DriverStatus)
  status: DriverStatus;
}