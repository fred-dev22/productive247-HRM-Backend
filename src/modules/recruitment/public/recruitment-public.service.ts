import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecruitmentNotifyService } from '../recruitment-notify.service';
import { REFERENCE_PREFIXES } from '../recruitment.constants';
import { nextReferenceCode } from '../recruitment.util';
import { PublicApplyDto } from './dto/public-apply.dto';

// Portail carriere public — aucune authentification. Les offres sont
// adressees par leur jeton opaque (JobOffer.PublicToken), jamais par leur id
// interne. L'anti-spam (honeypot, throttling, captcha) reste a ajouter, voir
// BACKLOG "portail carriere sans protection".
@Injectable()
export class RecruitmentPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: RecruitmentNotifyService,
  ) {}

  private publicShape(o: {
    Title: string;
    EntityName: string;
    ContractType: string;
    Location: string;
    Description: string;
    PublishedAt: Date | null;
    PublicToken: string;
    Views: number;
  }) {
    return {
      title: o.Title,
      entityName: o.EntityName,
      contractType: o.ContractType,
      location: o.Location,
      description: o.Description,
      publishedAt: o.PublishedAt,
      token: o.PublicToken,
      views: o.Views,
    };
  }

  async listPublished() {
    const offers = await this.prisma.jobOffer.findMany({
      where: { Status: 'Published', IsDeleted: false },
      orderBy: { PublishedAt: 'desc' },
    });
    return offers.map((o) => this.publicShape(o));
  }

  async getByToken(token: string, countView: boolean) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { PublicToken: token, Status: 'Published', IsDeleted: false },
    });
    if (!offer) {
      throw new NotFoundException("Cette offre n'existe plus ou n'est pas publiee");
    }
    if (countView) {
      await this.prisma.jobOffer.update({ where: { Id: offer.Id }, data: { Views: { increment: 1 } } });
    }
    return this.publicShape({ ...offer, Views: offer.Views + (countView ? 1 : 0) });
  }

  private async portalAuthorId(): Promise<string> {
    const system = await this.prisma.employee.findFirst({ where: { IsSystem: true }, select: { Id: true } });
    if (system) return system.Id;
    const anyEmp = await this.prisma.employee.findFirstOrThrow({ select: { Id: true } });
    return anyEmp.Id;
  }

  private async refCode() {
    return nextReferenceCode(REFERENCE_PREFIXES.application, (p) =>
      this.prisma.recruitmentApplication.count({ where: { ReferenceCode: { startsWith: p } } }),
    );
  }

  async applyToOffer(token: string, dto: PublicApplyDto) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { PublicToken: token, Status: 'Published', IsDeleted: false },
    });
    if (!offer) {
      throw new NotFoundException("Cette offre n'est plus disponible");
    }
    const authorId = await this.portalAuthorId();
    const app = await this.prisma.recruitmentApplication.create({
      data: {
        ReferenceCode: await this.refCode(),
        JobOfferId: offer.Id,
        JobOfferTitle: offer.Title,
        CandidateName: dto.CandidateName,
        CandidateEmail: dto.CandidateEmail,
        CandidatePhone: dto.CandidatePhone,
        Source: 'Offer',
        CvFileName: dto.CvFileName,
        Status: 'New',
        AppliedAt: new Date(),
        CreatedBy: authorId,
      },
    });
    await this.notify.emailCandidate(dto.CandidateEmail, 'Candidature bien recue', {
      title: 'Candidature enregistree',
      bodyLines: [
        `Bonjour ${dto.CandidateName},`,
        `Nous avons bien recu votre candidature pour le poste <strong>${offer.Title}</strong>. Notre equipe RH revient vers vous.`,
      ],
    });
    await this.notify.notifyRecruiter(offer.CreatedBy, {
      title: 'Nouvelle candidature',
      message: `${dto.CandidateName} a postule a l'offre "${offer.Title}".`,
      href: '/hr/recruitment/applications',
    });
    this.notify.broadcast();
    return { ok: true, referenceCode: app.ReferenceCode };
  }

  async applySpontaneous(dto: PublicApplyDto) {
    const authorId = await this.portalAuthorId();
    const app = await this.prisma.recruitmentApplication.create({
      data: {
        ReferenceCode: await this.refCode(),
        CandidateName: dto.CandidateName,
        CandidateEmail: dto.CandidateEmail,
        CandidatePhone: dto.CandidatePhone,
        Source: 'Spontaneous',
        CvFileName: dto.CvFileName,
        Status: 'New',
        AppliedAt: new Date(),
        CreatedBy: authorId,
      },
    });
    await this.notify.emailCandidate(dto.CandidateEmail, 'Candidature spontanee bien recue', {
      title: 'Candidature spontanee enregistree',
      bodyLines: [
        `Bonjour ${dto.CandidateName},`,
        'Nous avons bien recu votre candidature spontanee. Elle rejoint notre vivier ; nous vous recontacterons si un poste correspond a votre profil.',
      ],
    });
    this.notify.broadcast();
    return { ok: true, referenceCode: app.ReferenceCode };
  }
}
