import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  Name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  Description?: string;
}
