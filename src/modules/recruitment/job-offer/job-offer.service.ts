import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecruitmentNotifyService } from '../recruitment-notify.service';
import { REFERENCE_PREFIXES } from '../recruitment.constants';
import { nextReferenceCode } from '../recruitment.util';
import { CreateJobOfferDto } from './dto/create-job-offer.dto';
import { UpdateJobOfferDto, CloseJobOfferDto } from './dto/update-job-offer.dto';

const INCLUDE = {
  hiringRequest: { select: { Id: true, ReferenceCode: true, PositionTitle: true } },
  evaluationTemplate: {
    select: { Id: true, Name: true, criteria: { orderBy: { Position: 'asc' as const }, select: { Label: true } } },
  },
  createdByEmployee: { select: { Id: true, FullName: true } },
  _count: { select: { applications: { where: { IsDeleted: false } } } },
} as const;

// Offre d'emploi. Aucun circuit de validation : Draft -> Published (une
// seule fois) -> Closed. "Si on veut publier, on publie une fois."
@Injectable()
export class JobOfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: RecruitmentNotifyService,
  ) {}

  private async findRaw(id: string) {
    const row = await this.prisma.jobOffer.findUnique({ where: { Id: id } });
    if (!row || row.IsDeleted) {
      throw new NotFoundException(`Offre ${id} introuvable`);
    }
    return row;
  }

  async create(dto: CreateJobOfferDto, employeeId: string) {
    if (dto.HiringRequestId) {
      const hr = await this.prisma.hiringRequest.findUnique({ where: { Id: dto.HiringRequestId } });
      if (!hr || hr.IsDeleted) {
        throw new NotFoundException(`Expression de besoin ${dto.HiringRequestId} introuvable`);
      }
    }
    if (dto.InterviewEvaluationTemplateId) {
      await this.assertTemplateExists(dto.InterviewEvaluationTemplateId);
    }
    const ReferenceCode = await nextReferenceCode(REFERENCE_PREFIXES.jobOffer, (p) =>
      this.prisma.jobOffer.count({ where: { ReferenceCode: { startsWith: p } } }),
    );
    const row = await this.prisma.jobOffer.create({
      data: {
        ReferenceCode,
        HiringRequestId: dto.HiringRequestId,
        Title: dto.Title,
        EntityName: dto.EntityName,
        ContractType: dto.ContractType,
        Location: dto.Location,
        Description: dto.Description,
        InterviewEvaluationTemplateId: dto.InterviewEvaluationTemplateId,
        Status: 'Draft',
        PublicToken: randomBytes(24).toString('hex'),
        CreatedBy: employeeId,
      },
      include: INCLUDE,
    });
    this.notify.broadcast();
    return row;
  }

  private async assertTemplateExists(id: string) {
    const tpl = await this.prisma.interviewEvaluationTemplate.findUnique({ where: { Id: id } });
    if (!tpl || tpl.IsDeleted) {
      throw new NotFoundException(`Grille d'evaluation ${id} introuvable`);
    }
  }

  findAll() {
    return this.prisma.jobOffer.findMany({
      where: { IsDeleted: false },
      include: INCLUDE,
      orderBy: { CreatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.jobOffer.findUnique({ where: { Id: id }, include: INCLUDE });
    if (!row || row.IsDeleted) {
      throw new NotFoundException(`Offre ${id} introuvable`);
    }
    return row;
  }

  async update(id: string, dto: UpdateJobOfferDto, employeeId: string) {
    const existing = await this.findRaw(id);
    if (existing.Status !== 'Draft') {
      throw new BadRequestException('Seule une offre en brouillon peut etre modifiee');
    }
    if (dto.InterviewEvaluationTemplateId) {
      await this.assertTemplateExists(dto.InterviewEvaluationTemplateId);
    }
    const row = await this.prisma.jobOffer.update({
      where: { Id: id },
      data: {
        HiringRequestId: dto.HiringRequestId !== undefined ? dto.HiringRequestId : existing.HiringRequestId,
        Title: dto.Title ?? existing.Title,
        EntityName: dto.EntityName ?? existing.EntityName,
        ContractType: dto.ContractType ?? existing.ContractType,
        Location: dto.Location ?? existing.Location,
        Description: dto.Description ?? existing.Description,
        InterviewEvaluationTemplateId:
          dto.InterviewEvaluationTemplateId !== undefined
            ? dto.InterviewEvaluationTemplateId
            : existing.InterviewEvaluationTemplateId,
        ModifiedBy: employeeId,
        ModifiedAt: new Date(),
      },
      include: INCLUDE,
    });
    this.notify.broadcast();
    return row;
  }

  async publish(id: string, employeeId: string) {
    const existing = await this.findRaw(id);
    if (existing.Status === 'Published') {
      throw new BadRequestException('Cette offre est deja publiee');
    }
    if (existing.Status !== 'Draft') {
      throw new BadRequestException('Seule une offre en brouillon peut etre publiee');
    }
    const row = await this.prisma.jobOffer.update({
      where: { Id: id },
      data: { Status: 'Published', PublishedAt: new Date(), ModifiedBy: employeeId, ModifiedAt: new Date() },
      include: INCLUDE,
    });
    this.notify.broadcast();
    return row;
  }

  async close(id: string, dto: CloseJobOfferDto, employeeId: string) {
    const existing = await this.findRaw(id);
    if (existing.Status === 'Closed') {
      throw new BadRequestException('Cette offre est deja cloturee');
    }
    const row = await this.prisma.jobOffer.update({
      where: { Id: id },
      data: {
        Status: 'Closed',
        RecruitmentCost: dto.RecruitmentCost,
        ModifiedBy: employeeId,
        ModifiedAt: new Date(),
      },
      include: INCLUDE,
    });
    this.notify.broadcast();
    return row;
  }

  async remove(id: string, employeeId: string) {
    const existing = await this.findRaw(id);
    if (existing.Status === 'Published') {
      throw new BadRequestException('Cloturez l\'offre avant de la supprimer');
    }
    await this.prisma.jobOffer.update({
      where: { Id: id },
      data: { IsDeleted: true, DeletedBy: employeeId, DeletedAt: new Date() },
    });
    this.notify.broadcast();
    return { ok: true };
  }
}
