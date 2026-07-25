import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';

const WORK_DAYS_INCLUDE = {
  workDays: true,
  createdByEmployee: { select: { FullName: true } },
  modifiedByEmployee: { select: { FullName: true } },
} as const;

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCalendarDto, createdBy: string) {
    return this.prisma.calendar.create({
      data: {
        Name: dto.Name,
        IsDefault: dto.IsDefault ?? false,
        CreatedBy: createdBy,
        workDays: { create: dto.WorkDays },
      },
      include: WORK_DAYS_INCLUDE,
    });
  }

  findAll() {
    return this.prisma.calendar.findMany({ include: WORK_DAYS_INCLUDE });
  }

  async findDefault() {
    const calendar = await this.prisma.calendar.findFirst({
      where: { IsDefault: true },
      include: WORK_DAYS_INCLUDE,
    });
    if (!calendar) {
      throw new NotFoundException("Aucun calendrier par défaut n'est configuré");
    }
    return calendar;
  }

  async findOne(id: string) {
    const calendar = await this.prisma.calendar.findUnique({
      where: { Id: id },
      include: WORK_DAYS_INCLUDE,
    });
    if (!calendar) {
      throw new NotFoundException(`Calendrier ${id} introuvable`);
    }
    return calendar;
  }

  async update(id: string, dto: UpdateCalendarDto, modifiedBy: string) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.calendar.update({
        where: { Id: id },
        data: {
          Name: dto.Name,
          IsDefault: dto.IsDefault,
          ModifiedBy: modifiedBy,
          ModifiedAt: new Date(),
        },
      });

      if (dto.WorkDays) {
        // The frontend always sends the full 7-day week — replace atomically
        // rather than trying to diff/upsert individual days.
        await tx.calendarWorkDay.deleteMany({ where: { CalendarId: id } });
        await tx.calendarWorkDay.createMany({
          data: dto.WorkDays.map((day) => ({ ...day, CalendarId: id })),
        });
      }

      return tx.calendar.findUniqueOrThrow({ where: { Id: id }, include: WORK_DAYS_INCLUDE });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.calendar.delete({ where: { Id: id } });
  }
}
