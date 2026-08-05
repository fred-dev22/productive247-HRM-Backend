import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

const MISSION_CATEGORIES = ['National', 'International'];
const TRANSPORT_MODES = ['PersonalCar', 'CompanyCar', 'PublicTransport', 'Plane', 'Other'];

export class CreateMissionOrderDto {
  // Optionnel : par defaut l'ordre est cree pour l'utilisateur courant. Ne
  // peut etre force a un autre employe que si l'appelant a MISSION_VOIR_TOUT
  // (ex: RH qui saisit un ordre pour un employe sans acces au systeme).
  @IsOptional()
  @IsUUID()
  EmployeeId?: string;

  @IsString()
  @IsNotEmpty()
  Destination: string;

  @IsIn(MISSION_CATEGORIES)
  MissionCategory: string;

  @IsString()
  @IsNotEmpty()
  Purpose: string;

  @IsDateString()
  DepartureDate: string;

  @IsDateString()
  ReturnDate: string;

  @IsIn(TRANSPORT_MODES)
  TransportModeGo: string;

  @IsIn(TRANSPORT_MODES)
  TransportModeReturn: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  AdvanceRequested?: number;

  @IsOptional()
  @IsString()
  Currency?: string;
}
