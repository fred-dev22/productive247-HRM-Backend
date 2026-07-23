import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  @IsNotEmpty()
  RoleId: string;
}
