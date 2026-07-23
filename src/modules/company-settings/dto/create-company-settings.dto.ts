import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCompanySettingsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  CompanyName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  Currency: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  Timezone: string;

  @IsIn(['WorkingDays', 'CalendarDays'])
  DayCountingRule: string;

  @IsNumber()
  DefaultMonthlyAccrualRate: number;

  @IsInt()
  @Min(0)
  DefaultCarryOverCap: number;
}
