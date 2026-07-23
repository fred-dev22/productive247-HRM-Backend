import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';

@Injectable()
export class LeaveTypeService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLeaveTypeDto, createdBy: string) {
    return this.prisma.leaveType.create({ data: { ...dto, CreatedBy: createdBy } });
  }

  findAll() {
    return this.prisma.leaveType.findMany();
  }

  findActive() {
    return this.prisma.leaveType.findMany({ where: { IsActive: true } });
  }

  async findOne(id: string) {
    const leaveType = await this.prisma.leaveType.findUnique({ where: { Id: id } });
    if (!leaveType) {
      throw new NotFoundException(`Type de congé ${id} introuvable`);
    }
    return leaveType;
  }

  async update(id: string, dto: UpdateLeaveTypeDto, modifiedBy: string) {
    await this.findOne(id);
    return this.prisma.leaveType.update({
      where: { Id: id },
      data: { ...dto, ModifiedBy: modifiedBy, ModifiedAt: new Date() },
    });
  }

  async toggleActive(id: string, modifiedBy: string) {
    const leaveType = await this.findOne(id);
    return this.prisma.leaveType.update({
      where: { Id: id },
      data: { IsActive: !leaveType.IsActive, ModifiedBy: modifiedBy, ModifiedAt: new Date() },
    });
  }

  async remove(id: string) {
    const leaveType = await this.findOne(id);
    if (leaveType.IsSystem) {
      throw new ForbiddenException(
        'Ce type de congé est fourni par défaut et ne peut pas être supprimé — désactivez-le à la place',
      );
    }
    return this.prisma.leaveType.delete({ where: { Id: id } });
  }
}
