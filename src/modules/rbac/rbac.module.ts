import { Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { PermissionController } from './permission.controller';

@Module({
  controllers: [RoleController, PermissionController],
  providers: [RoleService],
})
export class RbacModule {}
