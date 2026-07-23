import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePositionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  Code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  Title: string;

  @IsUUID()
  JobId: string;

  @IsUUID()
  OrganizationUnitId: string;

  @IsOptional()
  @IsUUID()
  ParentPositionId?: string;

  @IsIn(['Vacant', 'Occupied'])
  OccupationStatus: string;
}
