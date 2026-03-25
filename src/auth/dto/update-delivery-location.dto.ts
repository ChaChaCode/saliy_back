import { IsInt, Min } from 'class-validator';

export class UpdateDeliveryLocationDto {
  @IsInt()
  @Min(1)
  cdekCityCode: number;
}
