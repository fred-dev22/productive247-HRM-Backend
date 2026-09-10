import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PublicApplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  CandidateName: string;

  @IsEmail()
  CandidateEmail: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  CandidatePhone: string;

  // Le portail public ne stocke pas le fichier (voir mock) : seul le nom du
  // CV est conserve, la piece est transmise par un autre canal / demandee
  // ensuite. L'anti-spam du portail reste a faire (voir BACKLOG).
  @IsOptional()
  @IsString()
  @MaxLength(255)
  CvFileName?: string;
}
