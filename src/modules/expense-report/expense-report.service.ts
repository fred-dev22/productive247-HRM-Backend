import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalPoolService } from '../approval-pool/approval-pool.service';
import { CreateExpenseReportDto } from './dto/create-expense-report.dto';
import { UpdateExpenseReportDto } from './dto/update-expense-report.dto';
import { DecideExpenseReportDto } from './dto/decide-expense-report.dto';

const EDITABLE_STATUSES = ['Draft', 'Returned'];
const CANCELLABLE_STATUSES = ['Draft', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4', 'Approved'];
const DEFAULT_CURRENCY = 'MGA';

// Le frontend recalcule toujours le total depuis les lignes (voir
// stores/expenses.ts mapExpenseReport) — chaque mutation de statut doit donc
// renvoyer les lignes, pas seulement les colonnes modifiées, sinon la carte
// affichée localement après l'action perd son détail jusqu'au prochain fetch.
const REPORT_INCLUDE = {
  lines: { include: { expenseType: true } },
  employee: { select: { Id: true, FullName: true, EmployeeNumber: true } },
} as const;

@Injectable()
export class ExpenseReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalPoolService: ApprovalPoolService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────

  private async generateReferenceCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `NF-${year}-`;
    const count = await this.prisma.expenseReport.count({
      where: { ReferenceCode: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  private computeTotal(lines: { Amount: unknown }[]): number {
    return lines.reduce((s, l) => s + Number(l.Amount), 0);
  }

  private async findOneRaw(id: string) {
    const report = await this.prisma.expenseReport.findUnique({ where: { Id: id } });
    if (!report) {
      throw new NotFoundException(`Note de frais ${id} introuvable`);
    }
    return report;
  }

  private resolveActualApprover(
    member: { EmployeeId: string; InterimEmployeeId: string | null; InterimStartDate: Date | null; InterimEndDate: Date | null },
    at: Date,
  ): string {
    if (
      member.InterimEmployeeId &&
      member.InterimStartDate &&
      member.InterimEndDate &&
      at >= member.InterimStartDate &&
      at <= member.InterimEndDate
    ) {
      return member.InterimEmployeeId;
    }
    return member.EmployeeId;
  }

  // ── CRUD ─────────────────────────────────────────────────────────────

  async create(dto: CreateExpenseReportDto, requesterEmployeeId: string, canActForOthers: boolean) {
    const employeeId = dto.EmployeeId ?? requesterEmployeeId;
    if (employeeId !== requesterEmployeeId && !canActForOthers) {
      throw new ForbiddenException("Vous ne pouvez pas créer une note de frais pour un autre employé");
    }
    const employee = await this.prisma.employee.findUnique({ where: { Id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employé ${employeeId} introuvable`);
    }

    const currency = dto.Currency ?? DEFAULT_CURRENCY;
    const referenceCode = await this.generateReferenceCode();

    return this.prisma.expenseReport.create({
      data: {
        ReferenceCode: referenceCode,
        EmployeeId: employeeId,
        Title: dto.Title,
        MissionOrderId: dto.MissionOrderId,
        Currency: currency,
        Status: 'Draft',
        CreatedBy: requesterEmployeeId,
        lines: dto.Lines?.length
          ? {
              create: dto.Lines.map((l) => ({
                ExpenseDate: new Date(l.ExpenseDate),
                ExpenseTypeId: l.ExpenseTypeId,
                Description: l.Description,
                Amount: l.Amount,
                Currency: l.Currency ?? currency,
                HasDocument: l.HasDocument ?? false,
                CreatedBy: requesterEmployeeId,
              })),
            }
          : undefined,
      },
      include: REPORT_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateExpenseReportDto, requesterEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId && !canOverride) {
      throw new ForbiddenException("Vous ne pouvez modifier que vos propres notes de frais");
    }
    if (!EDITABLE_STATUSES.includes(existing.Status)) {
      throw new BadRequestException('Seule une note en brouillon ou retournée peut être modifiée');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.Lines) {
        await tx.expenseLine.deleteMany({ where: { ExpenseReportId: id } });
        if (dto.Lines.length) {
          await tx.expenseLine.createMany({
            data: dto.Lines.map((l) => ({
              ExpenseReportId: id,
              ExpenseDate: new Date(l.ExpenseDate),
              ExpenseTypeId: l.ExpenseTypeId,
              Description: l.Description,
              Amount: l.Amount,
              Currency: l.Currency ?? existing.Currency,
              HasDocument: l.HasDocument ?? false,
              CreatedBy: requesterEmployeeId,
            })),
          });
        }
      }
      return tx.expenseReport.update({
        where: { Id: id },
        data: {
          Title: dto.Title ?? existing.Title,
          MissionOrderId: dto.MissionOrderId !== undefined ? dto.MissionOrderId : existing.MissionOrderId,
          Currency: dto.Currency ?? existing.Currency,
          ModifiedBy: requesterEmployeeId,
          ModifiedAt: new Date(),
        },
        include: REPORT_INCLUDE,
      });
    });
  }

  async remove(id: string, requesterEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId && !canOverride) {
      throw new ForbiddenException("Vous ne pouvez supprimer que vos propres notes de frais");
    }
    if (existing.Status !== 'Draft') {
      throw new BadRequestException('Seule une note en brouillon peut être supprimée');
    }
    return this.prisma.expenseReport.delete({ where: { Id: id } });
  }

  async findOne(id: string) {
    const report = await this.prisma.expenseReport.findUnique({
      where: { Id: id },
      include: {
        employee: { select: { Id: true, FullName: true, EmployeeNumber: true } },
        lines: { include: { expenseType: true }, orderBy: { ExpenseDate: 'asc' } },
      },
    });
    if (!report) {
      throw new NotFoundException(`Note de frais ${id} introuvable`);
    }
    const decisions = await this.prisma.approvalDecision.findMany({
      where: { EntityType: 'ExpenseReport', EntityId: id },
      orderBy: { StepOrder: 'asc' },
      include: { validatedByEmployee: { select: { Id: true, FullName: true } } },
    });
    return { ...report, decisions, TotalAmount: this.computeTotal(report.lines) };
  }

  private async attachTotals<T extends { lines: { Amount: unknown }[] }>(reports: T[]): Promise<(T & { TotalAmount: number })[]> {
    return reports.map((r) => ({ ...r, TotalAmount: this.computeTotal(r.lines) }));
  }

  async findMine(employeeId: string) {
    const reports = await this.prisma.expenseReport.findMany({
      where: { EmployeeId: employeeId },
      include: { employee: { select: { Id: true, FullName: true, EmployeeNumber: true } }, lines: { include: { expenseType: true } } },
      orderBy: { CreatedAt: 'desc' },
    });
    return this.attachTotals(reports);
  }

  async findTeam(managerEmployeeId: string) {
    const unitIds = await this.collectManagedUnitIds(managerEmployeeId);
    if (unitIds.length === 0) return [];
    const reports = await this.prisma.expenseReport.findMany({
      where: { employee: { OrganizationUnitId: { in: unitIds } } },
      include: { employee: { select: { Id: true, FullName: true, EmployeeNumber: true } }, lines: { include: { expenseType: true } } },
      orderBy: { CreatedAt: 'desc' },
    });
    return this.attachTotals(reports);
  }

  private async collectManagedUnitIds(managerEmployeeId: string): Promise<string[]> {
    const managedRoots = await this.prisma.organizationUnit.findMany({
      where: { ManagerId: managerEmployeeId },
      select: { Id: true },
    });
    const collected: string[] = [];
    const queue = managedRoots.map((unit) => unit.Id);
    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      collected.push(currentId);
      const children = await this.prisma.organizationUnit.findMany({
        where: { ParentId: currentId },
        select: { Id: true },
      });
      queue.push(...children.map((child) => child.Id));
    }
    return collected;
  }

  async findAll() {
    const reports = await this.prisma.expenseReport.findMany({
      include: { employee: { select: { Id: true, FullName: true, EmployeeNumber: true } }, lines: { include: { expenseType: true } } },
      orderBy: { CreatedAt: 'desc' },
    });
    return this.attachTotals(reports);
  }

  async findPendingForMe(employeeId: string) {
    const inApproval = await this.prisma.expenseReport.findMany({
      where: { Status: { in: ['InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4'] } },
      include: { employee: { select: { Id: true, FullName: true, EmployeeNumber: true } }, lines: { include: { expenseType: true } } },
      orderBy: { CreatedAt: 'asc' },
    });
    const now = new Date();
    const result: typeof inApproval = [];
    for (const r of inApproval) {
      const member = await this.prisma.approvalPoolMember.findFirst({
        where: { ApprovalPoolId: r.ApprovalPoolId as string, StepOrder: r.CurrentApprovalStep as number },
      });
      if (member && this.resolveActualApprover(member, now) === employeeId) {
        result.push(r);
      }
    }
    return this.attachTotals(result);
  }

  // ── Workflow ─────────────────────────────────────────────────────────

  async submit(id: string, requesterEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId && !canOverride) {
      throw new ForbiddenException("Vous ne pouvez soumettre que vos propres notes de frais");
    }
    if (!EDITABLE_STATUSES.includes(existing.Status)) {
      throw new BadRequestException('Seule une note en brouillon ou retournée peut être soumise');
    }
    const lineCount = await this.prisma.expenseLine.count({ where: { ExpenseReportId: id } });
    if (lineCount === 0) {
      throw new BadRequestException('Ajoutez au moins une ligne de dépense avant de soumettre');
    }

    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { Id: existing.EmployeeId } });
    const pool = await this.approvalPoolService.findApplicablePool(employee.OrganizationUnitId, 'ExpenseReport');
    if (!pool) {
      throw new NotFoundException(
        "Aucun pool de validation de note de frais n'est configuré pour cette unité ou ses parents — contactez le RH",
      );
    }
    const firstStep = pool.members.slice().sort((a, b) => a.StepOrder - b.StepOrder)[0];
    if (!firstStep) {
      throw new NotFoundException('Le pool de validation applicable ne contient aucun validateur');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.expenseReport.update({
        where: { Id: id },
        data: {
          Status: `InApprovalN${firstStep.StepOrder}`,
          ApprovalPoolId: pool.Id,
          CurrentApprovalStep: firstStep.StepOrder,
          RejectionReason: null,
          SubmittedAt: new Date(),
          ModifiedBy: requesterEmployeeId,
          ModifiedAt: new Date(),
        },
        include: REPORT_INCLUDE,
      });
      await tx.approvalDecision.create({
        data: {
          EntityType: 'ExpenseReport',
          EntityId: id,
          ApprovalPoolMemberId: firstStep.Id,
          ValidatedByEmployeeId: this.resolveActualApprover(firstStep, new Date()),
          StepOrder: firstStep.StepOrder,
          Decision: 'Pending',
          CreatedBy: requesterEmployeeId,
        },
      });
      return updated;
    });
  }

  private async assertIsCurrentApprover(
    report: Awaited<ReturnType<ExpenseReportService['findOneRaw']>>,
    approverEmployeeId: string,
    canOverride: boolean,
  ) {
    if (canOverride) return;
    if (!report.ApprovalPoolId || report.CurrentApprovalStep == null) {
      throw new ForbiddenException("Cette note n'est pas en attente de validation");
    }
    const member = await this.prisma.approvalPoolMember.findFirst({
      where: { ApprovalPoolId: report.ApprovalPoolId, StepOrder: report.CurrentApprovalStep },
    });
    if (!member || this.resolveActualApprover(member, new Date()) !== approverEmployeeId) {
      throw new ForbiddenException("Vous n'êtes pas le validateur actuel de cette note de frais");
    }
  }

  async approve(id: string, dto: DecideExpenseReportDto, approverEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    await this.assertIsCurrentApprover(existing, approverEmployeeId, canOverride);

    const pendingDecision = await this.prisma.approvalDecision.findFirst({
      where: {
        EntityType: 'ExpenseReport',
        EntityId: id,
        StepOrder: existing.CurrentApprovalStep as number,
        Decision: 'Pending',
      },
    });
    if (!pendingDecision) {
      throw new BadRequestException("Aucune décision en attente pour cette étape");
    }

    const pool = await this.prisma.approvalPool.findUniqueOrThrow({
      where: { Id: existing.ApprovalPoolId as string },
      include: { members: true },
    });
    const nextStep = pool.members
      .filter((m) => m.StepOrder > (existing.CurrentApprovalStep as number))
      .sort((a, b) => a.StepOrder - b.StepOrder)[0];

    return this.prisma.$transaction(async (tx) => {
      await tx.approvalDecision.update({
        where: { Id: pendingDecision.Id },
        data: {
          Decision: 'Approved',
          Comment: dto.Comment,
          DecidedAt: new Date(),
          ValidatedByEmployeeId: approverEmployeeId,
        },
      });

      if (nextStep) {
        const updated = await tx.expenseReport.update({
          where: { Id: id },
          data: { Status: `InApprovalN${nextStep.StepOrder}`, CurrentApprovalStep: nextStep.StepOrder },
          include: REPORT_INCLUDE,
        });
        await tx.approvalDecision.create({
          data: {
            EntityType: 'ExpenseReport',
            EntityId: id,
            ApprovalPoolMemberId: nextStep.Id,
            ValidatedByEmployeeId: this.resolveActualApprover(nextStep, new Date()),
            StepOrder: nextStep.StepOrder,
            Decision: 'Pending',
            CreatedBy: approverEmployeeId,
          },
        });
        return updated;
      }

      return tx.expenseReport.update({ where: { Id: id }, data: { Status: 'Approved' }, include: REPORT_INCLUDE });
    });
  }

  async reject(id: string, dto: DecideExpenseReportDto, approverEmployeeId: string, canOverride: boolean) {
    if (!dto.Comment || dto.Comment.trim().length < 10) {
      throw new BadRequestException('Le motif du refus doit comporter au moins 10 caractères');
    }
    const existing = await this.findOneRaw(id);
    await this.assertIsCurrentApprover(existing, approverEmployeeId, canOverride);
    return this.closeApprovalStep(existing, 'Rejected', dto.Comment, approverEmployeeId);
  }

  async return_(id: string, dto: DecideExpenseReportDto, approverEmployeeId: string, canOverride: boolean) {
    if (!dto.Comment || dto.Comment.trim().length < 10) {
      throw new BadRequestException('Le commentaire doit comporter au moins 10 caractères');
    }
    const existing = await this.findOneRaw(id);
    await this.assertIsCurrentApprover(existing, approverEmployeeId, canOverride);
    return this.closeApprovalStep(existing, 'Returned', dto.Comment, approverEmployeeId);
  }

  private async closeApprovalStep(
    existing: Awaited<ReturnType<ExpenseReportService['findOneRaw']>>,
    decision: 'Rejected' | 'Returned',
    comment: string,
    approverEmployeeId: string,
  ) {
    const pendingDecision = await this.prisma.approvalDecision.findFirst({
      where: {
        EntityType: 'ExpenseReport',
        EntityId: existing.Id,
        StepOrder: existing.CurrentApprovalStep as number,
        Decision: 'Pending',
      },
    });

    return this.prisma.$transaction(async (tx) => {
      if (pendingDecision) {
        await tx.approvalDecision.update({
          where: { Id: pendingDecision.Id },
          data: { Decision: decision, Comment: comment, DecidedAt: new Date(), ValidatedByEmployeeId: approverEmployeeId },
        });
      }
      return tx.expenseReport.update({
        where: { Id: existing.Id },
        data: { Status: decision, RejectionReason: comment },
        include: REPORT_INCLUDE,
      });
    });
  }

  async cancel(id: string, requesterEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId && !canOverride) {
      throw new ForbiddenException("Vous ne pouvez annuler que vos propres notes de frais");
    }
    if (!CANCELLABLE_STATUSES.includes(existing.Status)) {
      throw new BadRequestException(`Une note au statut "${existing.Status}" ne peut plus être annulée`);
    }
    return this.prisma.expenseReport.update({
      where: { Id: id },
      data: { Status: 'Cancelled', ModifiedBy: requesterEmployeeId, ModifiedAt: new Date() },
      include: REPORT_INCLUDE,
    });
  }
}
