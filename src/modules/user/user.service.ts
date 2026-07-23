import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { SetUserPermissionDto } from './dto/set-user-permission.dto';
import { computeEffectivePermissions } from '../../common/permissions/effective-permissions';

const SALT_ROUNDS = 10;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitize<T extends { PasswordHash?: string }>(user: T) {
    const { PasswordHash, ...rest } = user;
    return rest;
  }

  // Active l'accès système d'un employé : crée le User et relie
  // Employee.UserId dans la même transaction (voir Employee.UserId, nullable
  // — un employé n'a par défaut aucun accès tant que ce n'est pas fait).
  async create(dto: CreateUserDto) {
    const { Password, EmployeeId, ...rest } = dto;

    const employee = await this.prisma.employee.findUnique({ where: { Id: EmployeeId } });
    if (!employee) {
      throw new NotFoundException(`Employé ${EmployeeId} introuvable`);
    }
    if (employee.UserId) {
      throw new BadRequestException('Cet employé a déjà un compte d\'accès système');
    }

    const PasswordHash = await bcrypt.hash(Password, SALT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { ...rest, PasswordHash } });
      await tx.employee.update({ where: { Id: EmployeeId }, data: { UserId: user.Id } });
      return this.sanitize(user);
    });
  }

  async findAll() {
    const users = await this.prisma.user.findMany({ include: { role: true } });
    return users.map((user) => this.sanitize(user));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { Id: id }, include: { role: true } });
    if (!user) {
      throw new NotFoundException(`Utilisateur ${id} introuvable`);
    }
    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const { Password, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest, ModifiedAt: new Date() };
    if (Password) {
      data.PasswordHash = await bcrypt.hash(Password, SALT_ROUNDS);
    }
    const user = await this.prisma.user.update({ where: { Id: id }, data });
    return this.sanitize(user);
  }

  async remove(id: string) {
    await this.findOne(id);
    const user = await this.prisma.user.delete({ where: { Id: id } });
    return this.sanitize(user);
  }

  async assignRole(id: string, dto: AssignRoleDto) {
    await this.findOne(id);
    const role = await this.prisma.role.findUnique({ where: { Id: dto.RoleId } });
    if (!role) {
      throw new NotFoundException(`Rôle ${dto.RoleId} introuvable`);
    }
    const user = await this.prisma.user.update({
      where: { Id: id },
      data: { RoleId: dto.RoleId, ModifiedAt: new Date() },
    });
    return this.sanitize(user);
  }

  async getEffectivePermissions(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { Id: id },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        userPermissions: { include: { permission: true } },
      },
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur ${id} introuvable`);
    }
    const effective = computeEffectivePermissions(
      user.role.rolePermissions.map((rp) => rp.permission.Code),
      user.userPermissions.map((up) => ({ Code: up.permission.Code, IsGranted: up.IsGranted })),
    );
    return {
      roleName: user.role.Name,
      permissions: [...effective],
      individualOverrides: user.userPermissions.map((up) => ({
        permissionId: up.PermissionId,
        code: up.permission.Code,
        isGranted: up.IsGranted,
      })),
    };
  }

  // IsGranted=true (ajout) ou false (retrait explicite) — un enregistrement
  // dans les deux cas, jamais une simple suppression (voir UserPermission).
  private async setPermissionOverride(userId: string, dto: SetUserPermissionDto, isGranted: boolean, createdBy: string) {
    await this.findOne(userId);
    const permission = await this.prisma.permission.findUnique({ where: { Id: dto.PermissionId } });
    if (!permission) {
      throw new NotFoundException(`Permission ${dto.PermissionId} introuvable`);
    }
    await this.prisma.userPermission.upsert({
      where: { UserId_PermissionId: { UserId: userId, PermissionId: dto.PermissionId } },
      update: { IsGranted: isGranted },
      create: { UserId: userId, PermissionId: dto.PermissionId, IsGranted: isGranted, CreatedBy: createdBy },
    });
    return this.getEffectivePermissions(userId);
  }

  grantPermission(userId: string, dto: SetUserPermissionDto, createdBy: string) {
    return this.setPermissionOverride(userId, dto, true, createdBy);
  }

  revokePermission(userId: string, permissionId: string, createdBy: string) {
    return this.setPermissionOverride(userId, { PermissionId: permissionId }, false, createdBy);
  }
}
