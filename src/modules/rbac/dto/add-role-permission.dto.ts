import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddRolePermissionDto {
  @IsUUID()
  @IsNotEmpty()
  PermissionId: string;
}
