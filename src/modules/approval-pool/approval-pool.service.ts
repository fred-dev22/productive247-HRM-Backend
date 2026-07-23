import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApprovalPoolDto } from './dto/create-approval-pool.dto';
import { UpdateApprovalPoolDto } from './dto/update-approval-pool.dto';

@Injectable()
export class ApprovalPoolService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateApprovalPoolDto, createdBy: string) {
    return this.prisma.approvalPool.create({ data: { ...dto, CreatedBy: createdBy } });
  }

  findAll() {
    return this.prisma.approvalPool.findMany();
  }

  async findOne(id: string) {
    const pool = await this.prisma.approvalPool.findUnique({ where: { Id: id } });
    if (!pool) {
      throw new NotFoundException(`Pool d'approbation ${id} introuvable`);
    }
    return pool;
  }

  async update(id: string, dto: UpdateApprovalPoolDto, modifiedBy: string) {
    await this.findOne(id);
    return this.prisma.approvalPool.update({
      where: { Id: id },
      data: { ...dto, ModifiedBy: modifiedBy, ModifiedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.approvalPool.delete({ where: { Id: id } });
  }
}
