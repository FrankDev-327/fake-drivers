import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { RideStatus } from '../../entities/ride.entity';

export class UpdateStatusDto {
  @IsEnum(RideStatus)
  status: RideStatus;

  @IsNumber()
  @IsOptional()
  fare?: number;
}