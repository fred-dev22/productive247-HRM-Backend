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
  @IsInt({ message: 'Le préavis minimum doit être un nombre entier de jours' })
  @Min(0, { message: 'Le préavis minimum ne peut pas être négatif' })
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

  // Ne correspond à aucune colonne LeaveType — déclenche, une fois le type
  // créé, un crédit rétroactif aux employés déjà actifs (mois en cours si
  // accumulation mensuelle, année complète sinon). Voir LeaveTypeService.create.
  @IsOptional()
  @IsBoolean()
  CreditExistingEmployees?: boolean;
}
