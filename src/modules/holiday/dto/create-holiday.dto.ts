import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  Name: string;

  @Type(() => Date)
  @IsDate()
  Date: Date;

  @IsOptional()
  @IsBoolean()
  IsRecurring?: boolean;

  @IsIn(['National', 'Local'])
  HolidayType: string;

  @IsOptional()
  @IsUUID()
  OrganizationUnitId?: string;
}
