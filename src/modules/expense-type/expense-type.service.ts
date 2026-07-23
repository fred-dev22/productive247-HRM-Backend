import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseTypeDto } from './dto/create-expense-type.dto';
import { UpdateExpenseTypeDto } from './dto/update-expense-type.dto';

@Injectable()
export class ExpenseTypeService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateExpenseTypeDto, createdBy: string) {
    return this.prisma.expenseType.create({ data: { ...dto, CreatedBy: createdBy } });
  }

  findAll() {
    return this.prisma.expenseType.findMany();
  }

  async findOne(id: string) {
    const expenseType = await this.prisma.expenseType.findUnique({ where: { Id: id } });
    if (!expenseType) {
      throw new NotFoundException(`Type de frais ${id} introuvable`);
    }
    return expenseType;
  }

  async update(id: string, dto: UpdateExpenseTypeDto, modifiedBy: string) {
    await this.findOne(id);
    return this.prisma.expenseType.update({
      where: { Id: id },
      data: { ...dto, ModifiedBy: modifiedBy, ModifiedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.expenseType.delete({ where: { Id: id } });
  }
}
