import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeCategoryDto } from './dto/create-employee-category.dto';
import { UpdateEmployeeCategoryDto } from './dto/update-employee-category.dto';
import { AddCategoryPermissionDto } from './dto/add-category-permission.dto';

@Injectable()
export class EmployeeCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  private include() {
    return { categoryPermissions: { include: { permission: true } } };
  }

  create(dto: CreateEmployeeCategoryDto, createdBy: string) {
    return this.prisma.employeeCategory.create({ data: { ...dto, CreatedBy: createdBy } });
  }

  findAll() {
    return this.prisma.employeeCategory.findMany({ include: this.include() });
  }

  async findOne(id: string) {
    const category = await this.prisma.employeeCategory.findUnique({
      where: { Id: id },
      include: this.include(),
    });
    if (!category) {
      throw new NotFoundException(`Catégorie d'employé ${id} introuvable`);
    }
    return category;
  }

  async update(id: string, dto: UpdateEmployeeCategoryDto, modifiedBy: string) {
    await this.findOne(id);
    return this.prisma.employeeCategory.update({
      where: { Id: id },
      data: { ...dto, ModifiedBy: modifiedBy, ModifiedAt: new Date() },
      include: this.include(),
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employeeCategory.delete({ where: { Id: id } });
  }

  // Ce gabarit (CategoryPermission) n'est JAMAIS relu pour les comptes déjà
  // créés — voir UserService.create (copie unique à la création du compte)
  // et le bandeau d'avertissement sur EmployeeCategoriesConfigView.vue.
  async addPermission(categoryId: string, dto: AddCategoryPermissionDto, createdBy: string) {
    await this.findOne(categoryId);
    const permission = await this.prisma.permission.findUnique({ where: { Id: dto.PermissionId } });
    if (!permission) {
      throw new NotFoundException(`Permission ${dto.PermissionId} introuvable`);
    }
    await this.prisma.categoryPermission.upsert({
      where: {
        EmployeeCategoryId_PermissionId: { EmployeeCategoryId: categoryId, PermissionId: dto.PermissionId },
      },
      update: {},
      create: { EmployeeCategoryId: categoryId, PermissionId: dto.PermissionId, CreatedBy: createdBy },
    });
    return this.findOne(categoryId);
  }

  async removePermission(categoryId: string, permissionId: string) {
    await this.findOne(categoryId);
    await this.prisma.categoryPermission.deleteMany({
      where: { EmployeeCategoryId: categoryId, PermissionId: permissionId },
    });
    return this.findOne(categoryId);
  }
}
