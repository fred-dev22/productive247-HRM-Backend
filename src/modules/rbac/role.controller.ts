import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddRolePermissionDto } from './dto/add-role-permission.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('roles')
export class RoleController {
  constructor(private readonly service: RoleService) {}

  // Lecture ouverte à tout utilisateur authentifié — nécessaire pour peupler
  // les listes de rôles dans l'UI (ex: assigner un rôle à un employé).
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('ROLE_GERER')
  create(@Body() dto: CreateRoleDto, @CurrentUser('employeeId') employeeId: string) {
    return this.service.create(dto, employeeId);
  }

  @Patch(':id')
  @RequirePermission('ROLE_GERER')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.update(id, dto, employeeId);
  }

  @Delete(':id')
  @RequirePermission('ROLE_GERER')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/permissions')
  @RequirePermission('ROLE_GERER')
  addPermission(@Param('id') id: string, @Body() dto: AddRolePermissionDto) {
    return this.service.addPermission(id, dto);
  }

  @Delete(':id/permissions/:permissionId')
  @RequirePermission('ROLE_GERER')
  removePermission(@Param('id') id: string, @Param('permissionId') permissionId: string) {
    return this.service.removePermission(id, permissionId);
  }
}
