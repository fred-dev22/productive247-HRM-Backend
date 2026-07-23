import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddRolePermissionDto } from './dto/add-role-permission.dto';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  private include() {
    return { rolePermissions: { include: { permission: true } } };
  }

  findAll() {
    return this.prisma.role.findMany({ include: this.include(), orderBy: { Name: 'asc' } });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { Id: id }, include: this.include() });
    if (!role) {
      throw new NotFoundException(`Rôle ${id} introuvable`);
    }
    return role;
  }

  create(dto: CreateRoleDto, createdBy: string) {
    return this.prisma.role.create({
      data: { ...dto, CreatedBy: createdBy },
      include: this.include(),
    });
  }

  async update(id: string, dto: UpdateRoleDto, modifiedBy: string) {
    const role = await this.findOne(id);
    if (role.IsSystem) {
      throw new ForbiddenException('Ce rôle système ne peut pas être modifié');
    }
    return this.prisma.role.update({
      where: { Id: id },
      data: { ...dto, ModifiedBy: modifiedBy, ModifiedAt: new Date() },
      include: this.include(),
    });
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.IsSystem) {
      throw new ForbiddenException('Ce rôle système ne peut pas être supprimé');
    }
    return this.prisma.role.delete({ where: { Id: id } });
  }

  async addPermission(roleId: string, dto: AddRolePermissionDto) {
    await this.findOne(roleId);
    const permission = await this.prisma.permission.findUnique({ where: { Id: dto.PermissionId } });
    if (!permission) {
      throw new NotFoundException(`Permission ${dto.PermissionId} introuvable`);
    }
    await this.prisma.rolePermission.upsert({
      where: { RoleId_PermissionId: { RoleId: roleId, PermissionId: dto.PermissionId } },
      update: {},
      create: { RoleId: roleId, PermissionId: dto.PermissionId },
    });
    return this.findOne(roleId);
  }

  async removePermission(roleId: string, permissionId: string) {
    await this.findOne(roleId);
    await this.prisma.rolePermission.deleteMany({
      where: { RoleId: roleId, PermissionId: permissionId },
    });
    return this.findOne(roleId);
  }
}
