import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreditBalanceDto {
  @IsUUID()
  EmployeeId: string;

  @IsUUID()
  LeaveTypeId: string;

  @IsNumber()
  @IsPositive()
  Amount: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  Reason?: string;
}
