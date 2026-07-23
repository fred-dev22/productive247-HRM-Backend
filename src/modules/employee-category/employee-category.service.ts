import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeCategoryDto } from './dto/create-employee-category.dto';
import { UpdateEmployeeCategoryDto } from './dto/update-employee-category.dto';

@Injectable()
export class EmployeeCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEmployeeCategoryDto, createdBy: string) {
    return this.prisma.employeeCategory.create({ data: { ...dto, CreatedBy: createdBy } });
  }

  findAll() {
    return this.prisma.employeeCategory.findMany();
  }

  async findOne(id: string) {
    const category = await this.prisma.employeeCategory.findUnique({ where: { Id: id } });
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
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employeeCategory.delete({ where: { Id: id } });
  }
}
