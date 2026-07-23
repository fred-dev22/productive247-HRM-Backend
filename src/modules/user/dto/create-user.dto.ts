import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  Username: string;

  @IsEmail()
  @MaxLength(150)
  Email: string;

  // Plaintext password from the client — hashed into PasswordHash by the
  // service before it ever reaches Prisma. Never stored or logged as-is.
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  Password: string;

  @IsOptional()
  @IsBoolean()
  IsActive?: boolean;

  // L'employé pour qui on active l'accès système — lié via Employee.UserId
  // dans la même transaction que la création du compte.
  @IsUUID()
  @IsNotEmpty()
  EmployeeId: string;

  @IsUUID()
  @IsNotEmpty()
  RoleId: string;
}
