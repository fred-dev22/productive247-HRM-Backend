import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateExpenseConfigDto {
  @IsUUID()
  EmployeeCategoryId: string;

  @IsUUID()
  ExpenseTypeId: string;

  @IsIn(['Local', 'National', 'International'])
  MissionCategory: string;

  @IsNumber()
  DailyRate: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  Currency: string;

  @IsOptional()
  @IsBoolean()
  DocumentRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  IsActive?: boolean;
}
