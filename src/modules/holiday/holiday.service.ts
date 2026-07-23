import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

@Injectable()
export class HolidayService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateHolidayDto, createdBy: string) {
    return this.prisma.holiday.create({ data: { ...dto, CreatedBy: createdBy } });
  }

  findAll() {
    return this.prisma.holiday.findMany();
  }

  // IsRecurring holidays apply every year (only the month/day is meaningful —
  // the stored Date is remapped onto the requested year). Non-recurring
  // holidays only apply to the specific year of their stored Date.
  // organizationUnitId, when provided, restricts Local holidays to that unit
  // while always including National ones (OrganizationUnitId === null).
  async findForYear(year: number, organizationUnitId?: string) {
    const holidays = await this.prisma.holiday.findMany({
      where: organizationUnitId
        ? { OR: [{ OrganizationUnitId: null }, { OrganizationUnitId: organizationUnitId }] }
        : undefined,
    });

    return holidays
      .filter((h) => h.IsRecurring || h.Date.getUTCFullYear() === year)
      .map((h) =>
        h.IsRecurring
          ? { ...h, Date: new Date(Date.UTC(year, h.Date.getUTCMonth(), h.Date.getUTCDate())) }
          : h,
      );
  }

  async findOne(id: string) {
    const holiday = await this.prisma.holiday.findUnique({ where: { Id: id } });
    if (!holiday) {
      throw new NotFoundException(`Jour férié ${id} introuvable`);
    }
    return holiday;
  }

  async update(id: string, dto: UpdateHolidayDto) {
    await this.findOne(id);
    return this.prisma.holiday.update({ where: { Id: id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.holiday.delete({ where: { Id: id } });
  }
}
