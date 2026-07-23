import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

@Injectable()
export class PositionService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreatePositionDto, createdBy: string) {
    return this.prisma.position.create({ data: { ...dto, CreatedBy: createdBy } });
  }

  findAll() {
    return this.prisma.position.findMany();
  }

  findByUnit(organizationUnitId: string) {
    return this.prisma.position.findMany({ where: { OrganizationUnitId: organizationUnitId } });
  }

  findVacant() {
    return this.prisma.position.findMany({ where: { OccupationStatus: 'Vacant' } });
  }

  async findOne(id: string) {
    const position = await this.prisma.position.findUnique({ where: { Id: id } });
    if (!position) {
      throw new NotFoundException(`Poste ${id} introuvable`);
    }
    return position;
  }

  async update(id: string, dto: UpdatePositionDto, modifiedBy: string) {
    await this.findOne(id);
    return this.prisma.position.update({
      where: { Id: id },
      data: { ...dto, ModifiedBy: modifiedBy, ModifiedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.position.delete({ where: { Id: id } });
  }
}
