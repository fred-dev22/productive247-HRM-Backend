import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  Code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  Name: string;

  @IsIn(['Standard', 'Medical'])
  WorkflowType: string;

  @IsOptional()
  @IsBoolean()
  MonthlyAccrual?: boolean;

  @IsNumber()
  DaysPerYear: number;

  @IsOptional()
  @IsNumber()
  DaysPerMonth?: number;

  @IsOptional()
  @IsBoolean()
  DocumentRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  CarryOverAllowed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  CarryOverCap?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  MinNoticeDays?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  Color: string;

  @IsOptional()
  @IsBoolean()
  IsActive?: boolean;

  @IsOptional()
  @IsBoolean()
  IsSystem?: boolean;
}
