import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  Code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  Title: string;

  @IsOptional()
  @IsString()
  Description?: string;

  @IsIn(['SeniorExecutive', 'Manager', 'Technician', 'Employee'])
  Category: string;

  @IsOptional()
  @IsBoolean()
  IsActive?: boolean;
}
