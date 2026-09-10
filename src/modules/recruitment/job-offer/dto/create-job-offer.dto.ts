import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateJobOfferDto {
  @IsOptional()
  @IsUUID()
  HiringRequestId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  Title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  EntityName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  ContractType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  Location: string;

  @IsString()
  @IsNotEmpty()
  Description: string;

  // Grille d'evaluation d'entretien rattachee (US15) — optionnelle.
  @IsOptional()
  @IsUUID()
  InterviewEvaluationTemplateId?: string;
}
