import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecruitmentNotifyService } from '../recruitment-notify.service';
import { EvaluateTrialDto, ExtendTrialDto } from './dto/trial.dto';

const INCLUDE = {
  contract: { select: { Id: true, ReferenceCode: true, Salary: true, Status: true } },
} as const;

@Injectable()
export class TrialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: RecruitmentNotifyService,
  ) {}

  private async findRaw(id: string) {
    const row = await this.prisma.trialEmployee.findUnique({ where: { Id: id } });
    if (!row || row.IsDeleted) {
      throw new NotFoundException(`Periode d'essai ${id} introuvable`);
    }
    return row;
  }

  list() {
    return this.prisma.trialEmployee.findMany({
      where: { IsDeleted: false },
      include: INCLUDE,
      orderBy: { CreatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.trialEmployee.findUnique({ where: { Id: id }, include: INCLUDE });
    if (!row || row.IsDeleted) {
      throw new NotFoundException(`Periode d'essai ${id} introuvable`);
    }
    return row;
  }

  async evaluate(id: string, dto: EvaluateTrialDto, employeeId: string) {
    await this.findRaw(id);
    const author = await this.prisma.employee.findUnique({
      where: { Id: employeeId },
      select: { FullName: true },
    });
    const row = await this.prisma.trialEmployee.update({
      where: { Id: id },
      data: {
        EvalScore: dto.Score,
        EvalComment: dto.Comment,
        EvalByName: author?.FullName ?? 'RH',
        EvalAt: new Date(),
        ModifiedBy: employeeId,
        ModifiedAt: new Date(),
      },
      include: INCLUDE,
    });
    this.notify.broadcast();
    return row;
  }

  async extend(id: string, dto: ExtendTrialDto, employeeId: string) {
    const existing = await this.findRaw(id);
    if (!['OnTrial', 'Extended'].includes(existing.Status)) {
      throw new BadRequestException('Seule une periode en cours peut etre prolongee');
    }
    const newEnd = new Date(dto.NewEndDate);
    if (newEnd <= existing.TrialEndDate) {
      throw new BadRequestException('La nouvelle echeance doit etre posterieure a l\'echeance actuelle');
    }
    const row = await this.prisma.trialEmployee.update({
      where: { Id: id },
      data: { Status: 'Extended', TrialEndDate: newEnd, ModifiedBy: employeeId, ModifiedAt: new Date() },
      include: INCLUDE,
    });
    this.notify.broadcast();
    return row;
  }

  async convert(id: string, employeeId: string) {
    const existing = await this.findRaw(id);
    if (!['OnTrial', 'Extended'].includes(existing.Status)) {
      throw new BadRequestException('Seule une periode en cours peut etre confirmee');
    }
    const row = await this.prisma.trialEmployee.update({
      where: { Id: id },
      data: { Status: 'Converted', ModifiedBy: employeeId, ModifiedAt: new Date() },
      include: INCLUDE,
    });
    this.notify.broadcast();
    return row;
  }

  async cancel(id: string, employeeId: string) {
    const existing = await this.findRaw(id);
    if (existing.Status === 'Converted' || existing.Status === 'Cancelled') {
      throw new BadRequestException(`Une periode "${existing.Status}" ne peut plus etre annulee`);
    }
    const row = await this.prisma.trialEmployee.update({
      where: { Id: id },
      data: { Status: 'Cancelled', ModifiedBy: employeeId, ModifiedAt: new Date() },
      include: INCLUDE,
    });
    this.notify.broadcast();
    return row;
  }
}
